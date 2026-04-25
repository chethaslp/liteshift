# Liteshift
> [!WARNING]
> This project is currently unfinished and has severe security vulnerabilities. Use with caution.

Liteshift is a liteweight self-hosted deployment platform as an alternative for [dokploy](https://dokploy.com) or [coolify](https://coolify.io/). Liteshift is optimised to utilise inbuilt linux system utilities like systemctl for process management your nodejs/bunjs projects. So, it does not use docker as the other alternatives does.
Liteshift also helps in connecting your domains to the processes and also has reverse-proxy with the help of caddy in the backend. Caddy also manages auto-SSL using Let's Encrpyt.

### How to use?

The frontend dashboard for liteshift is independent of the server you host. You can choose to host the frontend on your own OR use a publicly available server to connect to your host system. You can utilise the following public dashboard if you prefer:
<p align="center"> 
  <a href="https://liteshift.chethas.in">liteshift.chethas.in</a>
</p>
<p align="center">
  <img width="600" height="500" alt="image" src="https://github.com/user-attachments/assets/dbab973c-0c7c-4d2c-94b6-f446142f625c" />
</p>
The dashboard is self-intuitive. Use the "Create" button to create your deployment via direct file uplaod of the source code as ZIP or with a public github repo (RECOMMENDED).
Liteshift will auto-detect your runtime - Bun, Node or python.

### How to setup the server?

1. Create a fresh compute instance in a cloud provider of your choice, or you could also use your homelab setup or even a Raspberry Pi - as long as they use linux. At the momment liteshift works ONLY on linux.
1. Now once everything is setup use the command line to execute the following command:
```bash
bash <(curl -s https://raw.githubusercontent.com/chethaslp/liteshift-host/refs/heads/main/install.sh)
```

  This script auto setups everything, please ensure to read the [Source Code](https://github.com/chethaslp/liteshift-host/blob/main/install.sh) before running any bash files on your system.

What this script does:
  1. Runs apt-get update and installs curl.
  1. Installs Node.js, git, python3, pip, unzip, and Bun.
  1. Clones [chethaslp/liteshift-host](https://github.com/chethaslp/liteshift-host) into /root/liteshift, and builds the package.
  1. Installs Caddy, setups a reverse_proxy to port 8008 
  1. Creates liteshift.service, enables and starts the service to run in background.

Once the script is setup, the host is open for the port 8008 in your instance.

3. Now, use [your public IP]:8008 to connect to your server with the dashboard.
4. Done.
