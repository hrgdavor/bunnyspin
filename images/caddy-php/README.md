# cady with php test

This folder buids image for testing setup of `php` with `caddy`, which unfortunately is not trivial, so it is best to test the details in a small dedicated image for faster iteration.

> Install of `caddy` and `php` takes some time, so it is wise to separate to at least two steps. 
> - 1 - slow install layer
> - 2 - faster config layer that writes configuration 

We test and validate configuration untili it works. Otherwise we would be waiting for  long install steps on each iteration.

## build

```sh
bun ..\..\build.js hrg-base .\install.js caddy-php:1
bun ..\..\build.js caddy-php:1 .\setup.js caddy-php:2
```

## test
>This image uses `test.local` domain so you need to add it to your hosts file
>```
>127.0.0.1 test.local
>```

To test the image and see if php works, run the image:
```
docker run --rm -it -p 80:80 -p 443:443 caddy-php:2
```
and visit https://test.local


> check geenrated configuration from a shell inside image (this will skip supervisor and caddy will not be active)
```
docker run --rm -it --entrypoint /usr/bin/fish caddy-php:2
```


## php package

for details check [php.md](../apt-packages-notes/php.md)
