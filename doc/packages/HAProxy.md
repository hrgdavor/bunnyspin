# HAProxy

# Install


```sh
# Add the HAProxy PPA
add-apt-repository ppa:vbernat/haproxy-3.2 -y
apt-get update
apt-get install haproxy -y
systemctl enable haproxy
systemctl start haproxy
```

# Configuration

- Configuration: `/etc/haproxy/haproxy.cfg`
- test your config for syntax errors: `haproxy -c -f /etc/haproxy/haproxy.cfg`

# PPA versus official

You probably should use PPA, as Ubuntu's default repositories generally lag **1 to 3 years** behind the latest stable HAProxy release, depending on which Ubuntu LTS version you are using. 

Current Version Gap (as of Feb 2026)

| Ubuntu Version        | Default HAProxy Version | Latest Stable Version | Gap                            |
| :-------------------- | :---------------------- | :-------------------- | :----------------------------- |
| **24.04 LTS (Noble)** | **2.8.x**               | **3.3.x**             | ~2.5 years (2 major versions)  |
| **22.04 LTS (Jammy)** | **2.4.x**               | **3.3.x**             | ~4.5 years (4+ major versions) |

# IP ban

You **really should** use it unless you have something else in front of your HAProxy that does that already.
It is likely more efficinat to have HAProxy if you want ip bans, instead of doing it with (apache, Caddy, nginx,...)

To efficiently manage a ban list that stays persistent, use HAProxy Map files combined with the Runtime API.


```
frontend main_lb
    bind *:443 ssl crt /etc/ssl/certs/site.pem
    
    # Use map_ip for CIDR range support in the whitelist
    acl is_whitelisted src,map_ip(/etc/haproxy/whitelist.map) -m found
    
    # 2. BANLIST: Only reject if NOT whitelisted AND found in banlist
    tcp-request connection reject if !is_whitelisted { src,map_ip(/etc/haproxy/banlist.map) -m found }

    # 3. Frequency tracking
    stick-table type ip size 1m expire 5m store http_req_rate(10s)
    http-request track-sc0 src
```

create empty 
- whitelist file `/etc/haproxy/whitelist.map` 
  - format: `IP 1` (`1.2.3.4 1`)
  - CIRD ip examples `192.168.1.0/24 1` `10.0.0.0/8 1` to whiteliset ranges
- and banlist file `/etc/haproxy/banlist.map`
  - format: `IP <timestamp_of_ban>`  (`1.2.3.4 1707900000`)

# 

Examples
```sh
# Whitelist an IP
bun haproxy-ban.js whitelist 192.168.1.100

# Check if IP is whitelisted
bun haproxy-ban.js is-whitelisted 192.168.1.100

# Ban an IP
bun haproxy-ban.js ban 10.0.0.50

# Unban an IP
bun haproxy-ban.js unban 10.0.0.50
```

# migration

HAProxy can be used to migrate https too, for example from nginx to caddy without HAProxy handling the certs. 

Create `/etc/haproxy/caddy_domains.lst`

```
support.domain.com 1
other.domain.com 1
```

edit `/etc/haproxy/haproxy.cfg` and after config change or lsit changes check config `haproxy -c -f /etc/haproxy/haproxy.cfg` and tehn reload `systemctl reload haproxy`

```
# --- HTTP Frontend (Standard Forwarding) ---
frontend main_http
    bind *:80
    mode http
    acl is_caddy hdr(host),lower,map(/etc/haproxy/caddy_domains.lst) -m found
    use_backend caddy_http if is_caddy
    default_backend nginx_http

# --- HTTPS Frontend (SSL Passthrough) ---
frontend main_https
    bind *:443
    mode tcp
    option tcplog
    
    # Wait for the SNI (Server Name) to be sent by the client
    tcp-request inspect-delay 5s
    tcp-request content accept if { req_ssl_hello_type 1 }

    # ACL based on SNI
    acl is_caddy_sni req_ssl_sni,lower,map(/etc/haproxy/caddy_domains.lst) -m found
    
    use_backend caddy_https if is_caddy_sni
    default_backend nginx_https

# --- Backends ---
backend nginx_http
    mode http
    server nginx_srv 127.0.0.1:1080 check

backend nginx_https
    mode tcp
    server nginx_srv 127.0.0.1:1443 check

backend caddy_http
    mode http
    server caddy_srv 127.0.0.1:2080 check

backend caddy_https
    mode tcp
    server caddy_srv 127.0.0.1:2443 check
```

it is critical to not forget in http defintion to use `mode tcp`

> you may get error: The **ERR_SSL_PROTOCOL_ERROR** 
> it occurs because HAProxy is likely trying to "speak" HTTP to a port that Nginx or Caddy expects to be encrypted (or vice-versa), or you are using the ssl keyword on a backend when > you actually want SSL Passthrough. 
> Since HAProxy has no certs, it must operate in mode tcp for port 443 to pass the encrypted data directly to your backends.
