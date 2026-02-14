const std = @import("std");
const testing = std.testing;
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;
const expectError = std.testing.expectError;

const haproxy = @import("main.zig");

test "isWhitelisted - non-existent file returns false" {
    try expect(!haproxy.isWhitelisted("1.2.3.4"));
}

test "isWhitelisted - empty file returns false" {
    // Create empty whitelist file
    const white_file = try std.fs.cwd().createFile("test_whitelist.map", .{});
    defer white_file.close();
    defer std.fs.cwd().deleteFile("test_whitelist.map") catch {};

    try expect(!haproxy.isWhitelisted("1.2.3.4"));
}

test "isWhitelisted - finds existing IP" {
    const white_file = try std.fs.cwd().createFile("test_whitelist.map", .{});
    defer white_file.close();
    defer std.fs.cwd().deleteFile("test_whitelist.map") catch {};

    // Write test data
    try white_file.writer().print("1.2.3.4 1\n5.6.7.8 1\n", .{});

    try expect(haproxy.isWhitelisted("1.2.3.4"));
    try expect(!haproxy.isWhitelisted("9.10.11.12"));
}

test "whitelistIP - creates file and adds entry" {
    const test_white = "test_whitelist2.map";

    // Cleanup if exists
    _ = std.fs.cwd().deleteFile(test_white) catch {};

    try haproxy.whitelistIP("192.168.1.100");

    // Verify file was created and contains IP
    const file = std.fs.cwd().openFile(test_white, .{ .mode = .read_only }) catch unreachable;
    defer file.close();

    const contents = try file.readToEndAlloc(std.testing.allocator, 1024);
    defer std.testing.allocator.free(contents);

    try expect(std.mem.containsAtLeast(u8, contents, 1, "192.168.1.100"));

    std.fs.cwd().deleteFile(test_white) catch {};
}

test "banIP - skips whitelisted IP" {
    const test_white = "test_white_ban.map";
    const test_ban = "test_ban.map";

    // Cleanup
    _ = std.fs.cwd().deleteFile(test_white) catch {};
    _ = std.fs.cwd().deleteFile(test_ban) catch {};

    // Whitelist first
    try haproxy.whitelistIP("10.0.0.1");

    // Try to ban - should be skipped
    try haproxy.banIP("10.0.0.1");

    // Verify ban file doesn't contain IP
    const ban_file = std.fs.cwd().openFile(test_ban, .{ .mode = .read_only }) catch |err| {
        try expectError(error.FileNotFound, err);
        return;
    };
    defer ban_file.close();

    const ban_contents = try ban_file.readToEndAlloc(std.testing.allocator, 1024);
    defer std.testing.allocator.free(ban_contents);
    try expect(!std.mem.containsAtLeast(u8, ban_contents, 1, "10.0.0.1"));

    // Cleanup
    std.fs.cwd().deleteFile(test_white) catch {};
    std.fs.cwd().deleteFile(test_ban) catch {};
}

test "banIP - adds non-whitelisted IP" {
    const test_ban = "test_ban2.map";

    // Cleanup
    _ = std.fs.cwd().deleteFile(test_ban) catch {};

    try haproxy.banIP("172.16.0.1");

    // Verify ban file contains IP and timestamp
    const file = std.fs.cwd().openFile(test_ban, .{ .mode = .read_only }) catch unreachable;
    defer file.close();

    const contents = try file.readToEndAlloc(std.testing.allocator, 1024);
    defer std.testing.allocator.free(contents);

    try expect(std.mem.containsAtLeast(u8, contents, 1, "172.16.0.1"));

    std.fs.cwd().deleteFile(test_ban) catch {};
}

test "unbanIP - removes specific IP" {
    const test_ban = "test_unban.map";

    // Cleanup and create test data
    _ = std.fs.cwd().deleteFile(test_ban) catch {};
    const file = try std.fs.cwd().createFile(test_ban, .{});
    try file.writer().print("192.168.0.1 1234567890\n10.0.0.2 1234567891\n", .{});
    file.close();

    try haproxy.unbanIP("192.168.0.1");

    // Verify IP was removed
    const new_file = std.fs.cwd().openFile(test_ban, .{ .mode = .read_only }) catch unreachable;
    defer new_file.close();

    const contents = try new_file.readToEndAlloc(std.testing.allocator, 1024);
    defer std.testing.allocator.free(contents);

    try expect(!std.mem.containsAtLeast(u8, contents, 1, "192.168.0.1"));
    try expect(std.mem.containsAtLeast(u8, contents, 1, "10.0.0.2"));

    std.fs.cwd().deleteFile(test_ban) catch {};
}

test "cleanupBans - removes expired bans" {
    const test_ban = "test_cleanup.map";

    // Cleanup and create test data
    _ = std.fs.cwd().deleteFile(test_ban) catch {};
    const file = try std.fs.cwd().createFile(test_ban, .{});

    const now = std.time.milliTimestamp();
    // Valid ban (within TTL)
    try file.writer().print("1.1.1.1 {d}\n", .{now - 1000000}); // 16min ago
    // Expired ban (older than 24h)
    try file.writer().print("2.2.2.2 {d}\n", .{now - 2 * haproxy.BAN_TTL_MS});

    file.close();

    try haproxy.cleanupBans();

    // Verify only valid ban remains
    const new_file = std.fs.cwd().openFile(test_ban, .{ .mode = .read_only }) catch unreachable;
    defer new_file.close();

    const contents = try new_file.readToEndAlloc(std.testing.allocator, 1024);
    defer std.testing.allocator.free(contents);

    try expect(std.mem.containsAtLeast(u8, contents, 1, "1.1.1.1"));
    try expect(!std.mem.containsAtLeast(u8, contents, 1, "2.2.2.2"));

    std.fs.cwd().deleteFile(test_ban) catch {};
}
