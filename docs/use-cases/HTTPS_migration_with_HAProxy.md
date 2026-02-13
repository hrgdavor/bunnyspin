# Migrate HTTPS from one server to another

This can be done in general, can be used for migrating on same machine, or network, different software or different versions.

# The migration

Concrete case here is migrating domains with HTTPS from `nginx` to `Caddy` using `HAProxy`, doing it one by one to reduce service disruption.
Also to have quick option to revert if new Caddy config for specific server has issues (websockets, integrations like PHP or ruby).

SNI (Server Name Indication) makes this possible as it allows HAProxy to transparently forward HTTPS traffic without decryption or holding certificates (read more about it toward end of this document).





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
