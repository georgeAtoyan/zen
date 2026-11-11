---
title: From Docker run to Compose
description: Description
pubDate: 2026-11-10
tags: ["Docker", "DevOps", "Sytem Administration", "Dockerfile", "Docker Compose", "Docker Volumes", "Docker Networking", "PostgreSQL"]
---

## Project Overview

A hands-on project that takes Docker from a single container to a multi-container stack managed by Docker Compose. It was built step by step: first with plain docker run commands to understand every piece, then translated into a single compose.yaml.

## Environment

| Component | Version / Details |
|---------|-------------|
| Host OS | Windows 11 |
| Docker | 29.9.2 |

## What It Does

The stack runs three services:

| Service | Image | Role | Exposed |
|---------|-------|------|---------|
| web | custom, built from web/Dockerfile (nginx:alpine base) | serves a static status page | localhost:8080 |
| db | postgres:18-alpine3.24 | PostgreSQL database holding a servers table | not exposed |
| adminer | adminer | web UI for managing the database | localhost:8081 |

## Architecture

![Architecture](/zen/architecture.png)

### How to read it:

- Two separate networks: ```web``` is on the project's default network. ```adminer``` and ```db``` are on ```atlas-net```. Traffic does not cross between them, so web cannot reach db by name or by IP.
- Only two published ports. The browser reaches ```web``` through localhost:8080 (mapped to nginx's port 80) and ```adminer``` through localhost:8081 (mapped to Adminer's port 8080)
- ```db``` is private. It publishes no port. ```adminer``` connects to it directly inside ```atlas-net``` using the service name ```db```, which Docker's built-in DNS resolves.
- Data lives outside the container. Postgres stores its files in the external volume ```atlas-db-data```, which survives container removal and ```docker compose down```.

## Key Design Decisions

- Least privilege networking. ```web``` serves a static page and needs no access to the database, so it runs outside ```atlas-net```. This was verified: from inside ```web```, both ```ping db``` and pinging db's IP fail.
- No published database port. Containers on the same network talk directly, so ```db``` needs no ```-p```. Only Adminer is published as the entry point.
- External volume. ```atlas-db-data``` is declared ```external: true```. Compose never creates or deletes it, so even ```docker compose down -v``` cannot destroy the data. The trade-off: the volume must be created once before the first up.
- Pinned image tags. ```postgres:18-alpine3.24``` locks the Postgres major version. A floating tag could move to a new major version whose data format is incompatible with the existing volume.
- Secrets in ```.env```. The database password is read from ```.env``` through variable interpolation. ```.env``` is git-ignored.

## How it was built

| Phase | Topic | Outcome |
|---------|-------|------|
| 1 | Dockerfile | custom nginx image serving my own page; versions v1 and v2 side by side |
| 2 | Bind mounts | live editing from the host; read-only mounts |
| 3 | Volumes | Postgres data surviving container removal; anonymous vs named volumes |
| 4 | Networks | Adminer reaching Postgres by name on a user-defined network |
| 5 | Compose | the whole stack from one file and one command |

## Phase 1: Writing Custom Image

###  1. Choosing a base image

I compared the two common nginx variants and decided to chose ```nginx:alpine``` because it's ~2.5x smaller: faster pulls, less disk space, fewer packages that could contain vulnerabilities.

| Image | Size |
|-------|------|
| ```nginx:latest``` (Debian-based) | 243 MB |
| ```nginx:alpine``` (Alpine-based) | 94.5 MB |

### 2. Finding where nginx serves files from

From the nginx page on Docker Hub: ```/usr/share/nginx/html```. This is where the default "Welcome to nginx!" ```index.html``` lives.

### 3. Dockerfile

Project folder contains ```Dockerfile``` (no extension) and ```index.html```.

```dockerfile
# Sets the Base Image
FROM nginx:alpine

# Copy takes index.html form the build context and places it over nginx's default page
COPY index.html /usr/share/nginx/html/index.html
```

I left out ```EXPOSE```. The base image already declares port 80 (visible under ```ExposedPorts``` in ```docker inspect nginx:alpine```). ```EXPOSE``` is only documentation anyway — it does not publish a port. ```-p``` at ```docker run``` does.

### 4. Building the Image

```docker
docker build -t web:v1 .
```

How the build works (layers)
1. ```FROM nginx:alpine``` — reuses the existing nginx:alpine layers unchanged.
2. ```COPY index.html ...``` — copies my file as it is at that moment into a new layer on top.

NOTE: The default nginx page is not edited or deleted — my layer sits on top and hides it.

### 5. Running a container

```docker
docker run -d --name web:v1 -p 8080:80 web:v1
```
![Webpage](/zen/phase1_docker_webpage.png)
![Docker process](/zen/phase1_docker_ps.png)

### 6. Versioning: v1 and v2 side by side

1. Edit ```index.html``` file on my machine
2. Refresh the v1 page -> nothing changed
3. Build ```web:v2``` from the same folder
4. Run a second container ```web-v2``` from ```web:v2``` image on a different host port (:8081)

NOTE: The v1 didn't change, the image holds a copy of the file taken at build time. The container has no connection back to the file on my host, so edits there can't reach it. Changing content = rebuild the image.

### Key Takeaways

- An image is a read-only template; a container is a running instance of it. One image can run many containers.
- Images are stacks of layers; layers only add, and shared layers are stored once.
- ```EXPOSE``` documents a port; ```-p``` publishes it.
- Container ports are isolated per container; host ports must be unique.

## Phase 2 - Bind Mounts (Editing without Rebuilding)

**Goal:** Connect a folder on my Windows machine directly into a container, so changes show up live — no rebuild. This time I won't use Dockerfile.

**The problem this solves:** in Phase 1 the image held a copy of ```index.html``` taken at build time. Every edit meant rebuilding the image and recreating the container.

### 1. Setup

New subfolder ```\site``` with its own ```index.html``` file.

```docker
docker run -d --name web-live -p 8080:80 -v [SOURCE_PATH\site]:/usr/share/nginx/html nginx:alpine
```

NOTE: Both sides of a bind mount must match: file → file, or folder → folder.

![Live webpage](/zen/phase2_webpage.png)

### 2. Read-write vs read-only

In ```docker inspect```, the mount showed ```"RW: true``` - read-write. Processes inside the container can create, edit and delete files in the mounted folder, and because it's a bind mount, those changes land directly in my real Windows folder. A buggy script or a compromised container could damage my files.

![Mount+rw](/zen/phase2_mount.png)

I will make it read-only, but before I have to stop the container and delete it:

```docker
docker run -d --name web-live -p 8080:80 -v [SOURCE_PATH\site]:/usr/share/nginx/html:ro nginx:alpine
```

![Mount+ro](/zen/phase2_mount+ro.png)

Test: access the container and try to create a file

```docker
docker exec -it web-live /bin/sh
touch /usr/share/nginx/html/text.html
```

![File Creation](/zen/phase2_create-file.png)

### Key Takeways

- **Bind mount** → **development**. When I'm changing files constantly, mounting lets me see changes instantly without rebuilding.
- A bind mount connects a host path directly into a container — no copy, changes are live.
- Both sides must be the same type: file → file or folder → folder.
- A failed ```docker run``` can still leave a container in the Created state — remove it before retrying with the same name.
- A folder mount hides everything the image had at that path; a file mount hides only that file.
- Bind mounts are read-write by default (```RW: true```) — the container can modify my real files.
- ```:ro``` makes the mount read-only for the container; the host can still edit.
- ```COPY``` → **delivery**. When the image goes to a repo, a server, or colleagues, the files must be inside the image. A bind mount depends on a folder that exists only on my machine ([SOURCE_PATH]) — anyone else would get an empty folder or a failed start.

**NUANCE:** in production, config files and certificates are often still bind-mounted, because they differ per server. App baked in, config mounted beside it.

## Phase 3 - Volumes

**Goal:** keep data safe when a container is deleted.

**The problem this solves:** in Phase 2, bind mounts protected my files — they live on Windows. A database is different: the app itself creates its data files inside the container. Without a mount, those files go into the container's writable layer, which is deleted together with the container on ```docker rm```.

|  | Bind mount (Phase 2) | Volume (Phase 3) |
|--|----------------------|------------------|
| Where data lives | a folder on the local host | storage Docker manages |
| Depends on a host path? | yes (exists only on the local host) | no - referenced by name |
| Best for | files to edit (code, config, HTML) | data the app writes (databases) |
| On Windows | slower; Linux permissions can trouble Postgres | fast - lives in Docker's Linux VM |

### 1. Pull Postgres image from Docker Hub 

```docker
docker pull postgres:18-alpine3.24
```

### 2. Run a container

```docker
docker run -d --name db -e POSTGRES_PASSWORD=password postgres:18-alpine3.24
```

![Postgres container](/zen/phase3_db.png)

### 3. Getting into psql

```docker
docker exec -it db /bin/sh
psql -U postgres
```

![Postgres db](/zen/phase3_postgres.png)

### 4. Create data

```sql
-- Create table with columns
CREATE TABLE servers ( name VARCHAR(255), status VARCHAR(255) );

-- Check the structure
\d servers

-- Insert rows
INSERT INTO servers (name, status) VALUES ('web', 'running'), ('db', 'stopped'), ('app', 'paused');

-- List all data from the table
SELECT * FROM servers; 
```

![Table creation](/zen/phase3_table.png)

### 5. Delete the container

* After starting ```db```, ```docker volume ls``` showed a new volume with a random hash name — even though I never created one.

![Anonymous Volume](/zen/phase3_anonymous_volume.png)

* ```docker rm db``` → the volume was still there.
* Started a new ```db``` → another new hash volume appeared.

![Anonymous Volume](/zen/phase3_second_volume.png)

* In psql: no ```servers``` table. Data "gone".

![Anonymous Volume](/zen/phase3_no_data.png)

**What actually happened: anonymous volumes**

The postgres image's Dockerfile contains a ```VOLUME``` instruction for its data folder. When no volume is named, Docker creates an **anonymous volume** (random hash name) automatically.

| Step | What Docker did |
|------|-----------------|
| Start ```db``` # 1 | created anonymous volume A — my table was written into A |
| ```docker rm db``` | removed the container, kept A |
| Start ```db``` #2 | created a new, empty anonymous volume B |

**NOTE:** The data wasn't destroyed — it was sitting in volume A. The new container just had no way to find it.

**Lesson:** having a volume isn't enough. It needs a **name** so the next container can reattach to it.

**Cleanup:** orphaned anonymous volumes pile up and waste disk. ```docker volume prune``` removes unused ones; ```docker rm -v``` removes a container's anonymous volumes along with it.

### 6. Create a named volume

```docker
docker volume create db-data
```

![Named Volume](/zen/phase3_named_volume.png)

### 7. Run a container with named volume attached

```docker
docker run -d --name db -v db-data:/var/lib/postgresql -e POSTGRES_PASSWORD=password postgres:18-alpine3.24
```

**Finding the data path**

Three ways to find where an image keeps its data:
- ```docker image inspect <image>``` → ```Config``` → ```Volumes``` (fastest)
- ```docker inspect <container>``` on an existing container → ```Mounts``` → ```Destination```
- the image's Dockerfile on GitHub → the ```VOLUME``` line, plus the ```PGDATA``` section on Docker Hub

![Image Volume](/zen/phase3_image_volume.png)

**NOTE:** ```password``` is fine for a local lab, but it must never reach GitHub. In Phase 5 it moves to a ```.env``` file excluded by ```.gitignore```.

### 8. Repeat step 4 (Data creation)

### 9. Data persistance test

1. Stop and remove ```db```.
2. ```docker volume ls``` → ```db-data``` still there.
3. Start a new ```db``` and the same ```-v``` and ```-e```.
4. ```SELECT * FROM servers;``` → same table, same rows.

**RESULT:** The data outlived its container.

### Key Takeaways

- Without a mount, app data lives in the container's writable layer and dies with ```docker rm```.
- Images can declare ```VOLUME```; Docker then creates anonymous volumes automatically — they survive ```rm``` but can't be reattached by name.
- Named volumes (```-v name:/container/path```) let a new container pick up the old data.
- Always find the data path for the exact image version you run.
- A volume in use by any container (even stopped) can't be deleted; once deleted, the data is gone.
- Containers are disposable; data belongs in volumes.
- Backups are my job — ```pg_dump``` or archiving the volume through a helper container.

## Phase 4 - Networks

**Goal:** Connect two containers so one can reach the other by name.

### 1. Pull Adminer Image

```docker
docker pull adminer:latest
```

### 2. Run Adminer on the default network

```docker
docker run -d --name adminer -p 8080:8083 adminer:latest
```

![Failed login](/zen/phase4_failed_login_with_domain_name.png)

**RESULT:** Connecting by domain name failed.

### 3. Connecting by IP 

```docker
docker inspect adminer
```

![IP Address](/zen/phase4_db_ip_address.png)

![Success login](/zen/phase4_success_login_with_ip_address.png)

**What this proves**

- The containers are connected — traffic flows between them on the default ```bridge``` network.
- What's missing is **name resolution**. The default bridge gives containers IPs but has no DNS for container names.

**Why IPs are a bad idea**

Containers are disposable. When ```db``` is recreated it can get a different IP, and anything configured with the old one breaks. Connections should use a name that stays stable.

### 4. Create my own network

```docker
docker network create local-net
```

![Network Creation](/zen/phase4_network.png)

### 5. Recreating both containers on custom network

```docker
# Run db container
docker run -d --name db -v db-data:/var/lib/postgresql -e POSTGRES_PASSWORD=password --network local-net postgres:18-alpine3.24

# Run adminer container
docker run -d --name adminer -p 8083:8080 --network local-net adminer:latest
```

**RESULT:** Logged into Adminer with Server = ```db``` → success, ```servers``` rows visible.

### 6. Network Inspection

```docker
docker inspect local-net
```

![Network Inspection](/zen/phase4_network_inspection.png)

**Why ```db``` needs no published ports**

```db``` has no ```-p```, yet Adminer reaches it.

- ```p``` **is only for traffic from outside** — host → container. It opens a door on my Windows machine.
- **Containers on the same network connect directly** to each other's container ports, like two machines on the same LAN. Adminer reaches Postgres inside ```local-net``` without going through the host.
- DNS is how Adminer finds ```db```; the shared network is why it can reach the port without ```-p```.

**Who can't reach ```db```:** my Windows host, my browser, anything on my LAN — only containers on ```local-net``` can. For a database that's good: it isn't exposed at all.

### Key Takeaways

- The default ```bridge``` network connects containers but has no DNS for container names.
- "Name does not resolve" is a DNS problem, not a "service down" problem — read errors carefully.
- Container IPs change when containers are recreated — connect by name.
- A user-defined network (```docker network create```) gives containers built-in DNS at 127.0.0.11.
- Attach containers with ```--network``` at ```docker run```, or ```docker network connect``` afterwards.
- Each network gets its own subnet; networks are isolated from each other, but containers can still reach the internet.
- ```-p``` is only for host → container traffic; containers on the same network talk directly.
- Don't publish database ports — expose only the front-end service.

## Phase 5 - Compose

**Goal:** Run the whole stack (```web```, ```db```, ```adminer```) together with one ```compose.yaml```

| Command | What it does |
|---------|--------------|
| ```docker compose config``` | validates the file and prints how Compose interpreted it |
| ```docker compose up -d``` | creates network and volume, builds web, starts all services |
| ```docker compose ps``` | lists this project's containers |
| ```docker compose down``` | stops and removes the project's containers and network |

**Decisions carried over:**

- ```web``` gets no ```networks```: key (least privilege). In Compose such a service joins the project's default network, not Docker's ```bridge``` — still isolated from ```local-net```.
- ```db``` gets no ```ports```
- ```web``` uses ```build```. ```build``` alone lets Compose name the image itself; ```build``` + ```image: web:v1``` builds it and tags it with my name.

### 1. Organize the project folder

```
project/
|--web/
|   |__Dockerfile
|   |__index.html
|.env
|compose.yaml
```

### 2. Writing the YAML

```yaml
services:
    db:
        image: postgres:18-alpine3.24
        environment:
            POSTGRES_PASSWORD: ${POSTGRESS_PASSWORD}
        volumes:
         - db-data:/var/lib/postgresql
        networks:
         - local-net
    adminer:
        image: adminer:latest
        ports:
         - "8083:8080"
        networks:
         - local-net
    web:
        build: web/
        ports:
         - "8080:80"

volumes:
    db-data:
     external: true
networks:
    local-net:
```

### 3. Moving the password out of the YAML

```compose.yaml``` goes to GitHub, so the password can't live there. So I placed Postgres password into ```.env``` file

```
POSTGRES_PASSWORD=password
```

### 4. Placing .env into .gitignore

```
.env
```

**NOTE:** ```.gitignore``` → contains ```.env```, so the real file is never committed to GitHub

**RESULT:** I am able to reach the static website, access the ```servers``` table from ```db``` via Adminer successfully.

### Key Takeaways

- **Least privilege**: put a container only on networks it needs.
- A database should be reached through a controlled path, with a limited database user — not by every container.
- Compose prefixes volume names with the project name. Use ```external: true``` or ```name:``` to reuse an existing volume.
- ```external: true``` protects data from ```docker compose down -v``` but must be created manually first.
- Secrets go in ```.env``` (git-ignored)