# Migrate HTTPS from one server to another

This can be done in general, can be used for migrating on same machine, or network, different software or different versions.

# The migration

Concrete case here is migrating domains with HTTPS from `nginx` to `Caddy` using `HAProxy`, doing it one by one to reduce service disruption.
Also to have quick option to revert if new Caddy config for specific server has issues (websockets, integrations like PHP or ruby).

**SNI** (Server Name Indication) makes this possible as it allows HAProxy to transparently forward HTTPS traffic without decryption or holding certificates (read more about it latenr in this document).

```sh
# Add the HAProxy PPA
add-apt-repository ppa:vbernat/haproxy-3.2 -y
apt-get update
apt-get install haproxy -y
systemctl enable haproxy
systemctl start haproxy
```

- Configuration: `/etc/haproxy/haproxy.cfg`
- test your config for syntax errors: `haproxy -c -f /etc/haproxy/haproxy.cfg`

### Create a Map File

Create a text file (e.g., `/etc/haproxy/domain2backend.map`) that maps your domains to a "target name."

```
# Domain            Target
old-site.com        nginx
www.old-site.com    nginx
new-site.com        caddy
another-site.com    caddy
```

### HAProxy Config

We will use this map to dynamically select the backend. This means when you want to migrate a domain, you **only change one line in the map file** and reload HAProxy.

`/etc/haproxy/haproxy.cfg`

```
frontend http-in
    bind *:80
    mode http
    # Look up the host in the map, default to 'nginx'
    set-var(txn.target) hdr(host),lower,map(/etc/haproxy/domain2backend.map,nginx)
    
    use_backend %[var(txn.target)]_http

frontend https-in
    bind *:443
    mode tcp
    tcp-request inspect-delay 5s
    tcp-request content accept if { req_ssl_hello_type 1 }

    # Look up the SNI in the same map, default to 'nginx'
    set-var(txn.target) req_ssl_sni,lower,map(/etc/haproxy/domain2backend.map,nginx)
    
    use_backend %[var(txn.target)]_https

# --- Backends (Names must match the map + suffix) ---
backend nginx_http
    mode http
    server s1 127.0.0.1:8080

backend caddy_http
    mode http
    server s1 127.0.0.1:8081

backend nginx_https
    mode tcp
    server s1 127.0.0.1:8443

backend caddy_https
    mode tcp
    server s1 127.0.0.1:8444
```

- **One Source of Truth:** The `.map` file defines which server owns which domain.
- **Validate before reload** `haproxy -c -f /etc/haproxy/haproxy.cfg`
- **Zero Downtime:** You can update the map file and run `systemctl reload haproxy`.
- **Let's Encrypt:** Since Port 80 is routed by the map, the HTTP-01 challenge will hit the correct server. Since Port 443 is passed through via SNI, Caddy’s automatic TLS and Nginx’s manual certs will continue to work perfectly.
- **Important Note on Caddy** When Caddy sits behind a proxy like this, it might get confused about its own ports. In your `Caddyfile`, ensure you specify the internal ports clearly:
  ```
  new-site.com {
      bind :8081 :8444
      # ... rest of config
  }
  ```



# SNI (Server Name Indication)

**SNI (Server Name Indication)** is a TLS protocol extension that allows a client (like a browser) to tell the server the **hostname** (e.g., `example.com`) it is trying to reach at the very beginning of a secure connection. 

Why We Need It

Normally, a server needs to show an SSL certificate *before* it can see any HTTP headers (like the `Host` header). Without SNI, if you have 10 websites on one IP address, the server wouldn't know which site you want and might show the **wrong certificate**, causing a "Connection Not Private" error. 

SNI is essentially like adding an **apartment number** to a street address so the mail reaches the right person in a shared building. 

How It Works in HAProxy

When using HAProxy for SSL termination, SNI allows you to host multiple domains on a single IP: 

1. **Client Hello:** The browser sends the domain name (SNI) in its first message.
2. **Cert Selection:** HAProxy looks at the SNI, finds the matching certificate in its directory, and presents it to the client.
3. **Routing:** After decryption, HAProxy can use that same SNI value (or the HTTP `Host` header) to decide which backend server should handle the request. 

Pros and Cons

- **Pros:** Saves money by using one IP address for many secure sites and simplifies certificate management.
- **Cons:** The hostname is sent in **plain text** during the handshake (though [Encrypted SNI (ESNI)](https://www.cloudflare.com/learning/ssl/what-is-encrypted-sni/) is being developed to fix this)

# HAProxy overhead 

**HAProxy overhead is negligible at 100 requests per second with TLS passthrough.**

## Performance Capacity

HAProxy routinely handles millions of requests per second on modern hardware, as shown in benchmarks reaching over 2 million RPS on a single AWS Graviton2 instance.  At just 100 RPS, this load represents a tiny fraction—less than 0.005%—of its proven capacity, leaving ample headroom even on basic servers.

## TLS Passthrough Impact

In TLS passthrough (TCP mode), HAProxy avoids decryption overhead, simply inspecting SNI for routing and proxying traffic, which adds minimal latency under 0.5 milliseconds in high-load tests.  Benchmarks confirm pure TCP forwarding supports over 130,000 sessions per second historically, with CPU usage staying extremely low at modest loads like 100 RPS

## Resource Usage

CPU and memory consumption remain trivial; event-driven design processes thousands of connections efficiently without significant load.  Even on low-end instances (e.g., 2 vCPUs), HAProxy sustains tens of thousands RPS with low latency, far exceeding 100 RPS needs.  Isolated reports of higher overhead often stem from misconfiguration, not inherent limits
