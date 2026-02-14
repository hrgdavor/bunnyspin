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
