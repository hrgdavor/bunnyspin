# MySQL

Scripting MySQL installation intentionally creaes a randomized root password, to avoid
opening to hackes mysql server by mistake.

V2. Scripting MySQL installation intentionally uses empty root password on ubuntu, make it use `auth_socket`
opening to hackes mysql server by mistake.


This requires specific process for adding database schemas for applications on top of such
image, or even inside same provisioning script.
