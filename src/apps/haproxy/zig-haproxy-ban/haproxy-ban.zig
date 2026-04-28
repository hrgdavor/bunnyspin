const std = @import("std");
const builtin = @import("builtin");
const fs = std.fs;
const mem = std.mem;
const time = std.time;
const net = std.net;
const ArrayList = std.ArrayList;
const Allocator = mem.Allocator;

const SOCKET_PATH = "/var/run/haproxy.sock";
const DEFAULT_BAN_MAP = "/etc/haproxy/banlist.map";
const DEFAULT_WHITE_MAP = "/etc/haproxy/whitelist.map";
const RATE_THRESHOLD: u32 = 150;
const BAN_TTL_MS: u64 = 24 * 60 * 60 * 1000;

const Config = struct {
    ban_map: []const u8,
    white_map: []const u8,
    socket_path: []const u8 = SOCKET_PATH,
};

// Parse config from args and set global paths
fn parseConfig(allocator: Allocator, args: [][*:0]u8) !Config {
    var ban_map = DEFAULT_BAN_MAP;
    var white_map = DEFAULT_WHITE_MAP;

    var i: usize = 1;
    while (i < args.len) : (i += 1) {
        const arg = std.mem.span(args[i]);
        if (mem.startsWith(u8, arg, "--ban-map=")) {
            ban_map = arg["--ban-map=".len..];
        } else if (mem.startsWith(u8, arg, "--white-map=")) {
            white_map = arg["--white-map=".len..];
        } else if (mem.eql(u8, arg, "--ban-map") and i + 1 < args.len) {
            i += 1;
            ban_map = std.mem.span(args[i]);
        } else if (mem.eql(u8, arg, "--white-map") and i + 1 < args.len) {
            i += 1;
            white_map = std.mem.span(args[i]);
        }
    }

    return Config{
        .ban_map = try allocator.dupe(u8, ban_map),
        .white_map = try allocator.dupe(u8, white_map),
    };
}

fn haproxyCmd(allocator: Allocator, cmd: []const u8) ![]u8 {
    var socket = try net.unixSocketConnect(.{ .path = SOCKET_PATH });
    defer socket.close();

    // Send command
    _ = try socket.writeAll(cmd);
    _ = try socket.writeAll("\n");

    // Read response
    var buffer: [4096]u8 = undefined;
    const bytes_read = try socket.readAll(buffer[0..]);

    return try allocator.dupe(u8, buffer[0..bytes_read]);
}

// helpers before isWhitelisted
fn ipToInt(ip: []const u8) !u32 {
    var parts = mem.split(u8, ip, ".");
    var result: u32 = 0;
    var shift: u5 = 24;

    var i: usize = 0;
    while (parts.next()) |part| : (i += 1) {
        if (i >= 4) return error.InvalidIp;
        result |= try std.fmt.parseInt(u8, part, 10) << @intCast(shift);
        shift -= 8;
    }
    return result;
}

// helpers before isWhitelisted
fn isIpInCidr(ip: []const u8, cidr: []const u8) bool {
    const slash_pos = mem.indexOfScalar(u8, cidr, '/') orelse return false;
    const cidr_ip = cidr[0..slash_pos];
    const mask_len = std.fmt.parseInt(u5, cidr[slash_pos + 1 ..], 10) catch return false;

    const ip_int = ipToInt(ip) catch return false;
    const cidr_int = ipToInt(cidr_ip) catch return false;
    const mask = ~@as(u32, 0) << (32 - mask_len);

    return (ip_int & mask) == (cidr_int & mask);
}

fn isWhitelisted(config: Config, ip: []const u8) bool {
    const white_file = fs.cwd().openFile(config.white_map, .{ .mode = .read_only }) catch return false;
    defer white_file.close();

    var buf_reader = std.io.bufferedReader(white_file.reader());
    var reader = buf_reader.reader();

    var buf: [1024]u8 = undefined;
    while (true) {
        const len = reader.readUntilDelimiterOrEof(&buf, '\n') catch |err| switch (err) {
            error.EndOfStream => break,
            else => return false,
        } orelse break;

        const line = mem.trim(u8, buf[0..len], " \n\r\t");
        if (line.len == 0) continue;

        // Split line into IP/CIDR and value
        var parts = mem.split(u8, line, " ");
        const network = parts.first() orelse continue;

        // Check exact match first (backward compatible)
        if (mem.eql(u8, network, ip)) {
            return true;
        }

        // Check CIDR match
        if (isIpInCidr(ip, network)) {
            return true;
        }
    }
    return false;
}

fn whitelistIP(allocator: Allocator, config:Config, ip: []const u8) !void {
    _ = try haproxyCmd(allocator, try std.fmt.allocPrint(allocator, "add map {} {} 1", .{ config.white_map, ip }));

    var white_file = try fs.cwd().openFile(config.white_map, .{ .mode = .read_write });
    defer white_file.close();

    try white_file.seekToEnd();
    _ = try white_file.writer().print("{s} 1\n", .{ip});

    std.log.info("WHITELISTED {s}", .{ip});
}

fn banIP(allocator: Allocator, config: Config, ip: []const u8) !void {
    if (isWhitelisted(config, ip)) return;

    const now = time.milliTimestamp();
    _ = try haproxyCmd(allocator, config, try std.fmt.allocPrint(allocator, "add map {} {} {}", .{ config.ban_map, ip, now }));

    var ban_file = try fs.cwd().openFile(config.ban_map, .{ .mode = .read_write });
    defer ban_file.close();

    try ban_file.seekToEnd();
    _ = try ban_file.writer().print("{s} {d}\n", .{ ip, now });

    std.log.info("BANNED {s}", .{ip});
}

fn unbanIP(allocator: Allocator, config: Config, ip: []const u8) !void {
    _ = try haproxyCmd(allocator, try std.fmt.allocPrint(allocator, "del map {} {}", .{ config.ban_map, ip }));

    var ban_file = try fs.cwd().openFile(config.ban_map, .{ .mode = .read_write });
    defer ban_file.close();

    var buf_reader = std.io.bufferedReader(ban_file.reader());
    var reader = buf_reader.reader();

    var temp_lines = ArrayList([]u8).init(allocator);
    defer {
        for (temp_lines.items) |line| allocator.free(line);
        temp_lines.deinit();
    }

    var buf: [1024]u8 = undefined;
    while (true) {
        const line = reader.readUntilDelimiterOrEof(&buf, '\n') catch |err| switch (err) {
            error.EndOfStream => break,
            else => continue,
        } orelse break;

        const trimmed = mem.trim(u8, buf[0..line], " \n\r\t");
        if (trimmed.len > 0 and !mem.startsWith(u8, trimmed, ip)) {
            const duped = try allocator.dupe(u8, trimmed);
            try temp_lines.append(duped);
        }
    }

    ban_file.setPosition(0);
    _ = try ban_file.truncate(0);

    for (temp_lines.items) |line| {
        _ = try ban_file.writer().print("{s}\n", .{line});
    }

    std.log.info("UNBANNED {s}", .{ip});
}

fn cleanupBans(allocator: Allocator, config: Config) !void {
    const now = time.milliTimestamp();
    var ban_file = try fs.cwd().openFile(config.ban_map, .{ .mode = .read_write });
    defer ban_file.close();

    var buf_reader = std.io.bufferedReader(ban_file.reader());
    var reader = buf_reader.reader();

    var valid_entries = ArrayList([]u8).init(allocator);
    defer {
        for (valid_entries.items) |line| allocator.free(line);
        valid_entries.deinit();
    }

    var buf: [1024]u8 = undefined;
    while (true) {
        const line_slice = reader.readUntilDelimiterOrEof(&buf, '\n') catch |err| switch (err) {
            error.EndOfStream => break,
            else => continue,
        } orelse break;

        const line = mem.trim(u8, buf[0..line_slice], " \n\r\t");
        if (line.len == 0) continue;

        var parts = mem.split(u8, line, " ");
        const ip = parts.first() orelse continue;
        const timestamp_str = parts.next() orelse continue;

        const timestamp = std.fmt.parseInt(u64, timestamp_str, 10) catch continue;
        if (now - timestamp < BAN_TTL_MS) {
            const duped = try allocator.dupe(u8, line);
            try valid_entries.append(duped);
        } else {
            _ = haproxyCmd(allocator, try std.fmt.allocPrint(allocator, "del map {} {}", .{ config.ban_map, ip })) catch {};
            std.log.info("EXPIRED {s}", .{ip});
        }
    }

    ban_file.setPosition(0);
    _ = try ban_file.truncate(0);

    for (valid_entries.items) |line| {
        _ = try ban_file.writer().print("{s}\n", .{line});
    }
}

fn monitor(allocator: Allocator, ) !void {
    const data = try haproxyCmd(allocator, "show table main_lb");
    defer allocator.free(data);

    var lines = mem.split(u8, data, "\n");
    while (lines.next()) |line| {
        // Match: entry.key=192.168.1.1 ... http_req_rate(10s)=123
        var ip_start: ?usize = null;
        var rate_start: ?usize = null;

        var i: usize = 0;
        while (i < line.len) : (i += 1) {
            if (ip_start == null and mem.eql(u8, line[i..mem.min(i + 9, line.len)], "entry.key=")) {
                ip_start = i + 9;
                i += 9;
                continue;
            }

            if (rate_start == null and mem.eql(u8, line[i..mem.min(i + 16, line.len)], "http_req_rate(10s)=")) {
                rate_start = i + 16;
                break;
            }
        }

        if (ip_start) |ip_pos| {
            const ip_end = mem.indexOf(u8, line[ip_pos..], " ") orelse line.len;
            const ip = line[ip_pos..ip_pos + ip_end];

            if (rate_start) |rate_pos| {
                const rate_end = mem.indexOfScalar(u8, line[rate_pos..], ')') orelse rate_pos + 3;
                const rate_str = line[rate_pos..rate_pos + rate_end];
                const rate = std.fmt.parseInt(u32, rate_str, 10) catch continue;

                if (rate > RATE_THRESHOLD and !isWhitelisted(ip)) {
                    try banIP(ip);
                    _ = haproxyCmd(allocator, try std.fmt.allocPrint(allocator, "clear table main_lb key {}", .{ip})) catch {};
                }
            }
        }
    }
}

fn printUsage() void {
    std.log.info("Usage: zig-out/bin/haproxy-rate-limiter <command> [IP]", .{});
    std.log.info("Commands:", .{});
    std.log.info("  monitor           - Run one-time monitoring check", .{});
    std.log.info("  cleanup           - Run one-time ban cleanup", .{});
    std.log.info("  whitelist <IP>    - Whitelist an IP", .{});
    std.log.info("  is-whitelisted <IP> - Check if IP is whitelisted", .{});
    std.log.info("  ban <IP>          - Ban an IP", .{});
    std.log.info("  unban <IP>        - Unban an IP", .{});
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const gpa_allocator = gpa.allocator();

    const args_it = try std.process.argsAlloc(gpa_allocator);
    defer std.process.argsFree(gpa_allocator, args_it);

    const config = try parseConfig(gpa_allocator, args_it);
    defer {
        gpa_allocator.free(config.ban_map);
        gpa_allocator.free(config.white_map);
    }
    const command = if (args_it.len > 1) std.mem.span(args_it[1]) else "monitor";

    if (mem.eql(u8, command, "monitor")) {
        std.log.info("Running one-time monitor check", .{});
        try monitor(gpa_allocator);
    } else if (mem.eql(u8, command, "cleanup")) {
        std.log.info("Running ban cleanup", .{});
        try cleanupBans(gpa_allocator, config);
    } else if (mem.eql(u8, command, "whitelist") and args_it.len > 2) {
        try whitelistIP(gpa_allocator, config, std.mem.span(args_it[2]));
    } else if (mem.eql(u8, command, "is-whitelisted") and args_it.len > 2) {
        const ip = std.mem.span(args_it[2]);
        std.log.info("{s} {s} is whitelisted", .{ if (isWhitelisted(ip)) "YES" else "NO", ip });
    } else if (mem.eql(u8, command, "ban") and args_it.len > 2) {
        try banIP(gpa_allocator, config, std.mem.span(args_it[2]));
    } else if (mem.eql(u8, command, "unban") and args_it.len > 2) {
        try unbanIP(gpa_allocator, config, std.mem.span(args_it[2]));
    } else {
        printUsage();
        std.process.exit(1);
    }

}
