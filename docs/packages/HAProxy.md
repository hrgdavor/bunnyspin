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

You **really should** use it unless you have something else in fromt of your HAProxy that does that already.

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
