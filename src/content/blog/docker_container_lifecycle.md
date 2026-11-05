---
title: Docker Container Lifecycle and Management - A Practical Administration Exercise
description: Description
pubDate: 2026-11-05
tags: ["Docker", "Containers", "Linux", "Docker CLI", "DevOps", "Sytem Administration"]
---

## Project Overview

This project focuses on practicing Docker container lifecycle management through a hands-on exercise using Alpine Linux.

The objective was to build a simple container environment and explore the fundamental operations involved in managing Docker container, including image management, container creation, execution, inspection, and lifecycle operations.

During the project, I worked with Docker commands to create and start container, access its internal shell, inspect running processes and resource usage, and manage its states. I also investigated container behavior, including why a container may stop immediately after being started when its main process terminates.

The project provided practical experience with Docker's container lifecycle and helped develop an understanding of how container processes interact with the Docker environment.

## Environment

| Component | Version / Details |
|---------|-------------|
| Host OS | Windows 11 |
| Docker | 29.9.2 |
| Container Image | Alpine |
| Image Tag | latest |

## Implementation

### 1. Image Management

For this project, I selected Alpine Linux as the base image. Alpine is a lightweight Linux distribution commonly used as a base for Docker containers.

```powershell
# Download the Alpine Image from Docker Hub
docker pull alpine:latest

# Verify the image
docker images

```

![Alpine Image](/zen/alpine_image.png)

### 2. Container Creation and Execution

After downloading the Alpine image, I created a container named alpine-lab.

The container did not appear in ```docker ps``` because it had not been started. However, it was visible in ```docker ps -a```, which displays all containers regardless of their state.

```powershell
# Create a container named alpine-lab
docker create --name alpine-lab alpine:latest

# Verify container's creation and inspect its state
docker ps
docker ps -a
```

![Alpine Image](/zen/container_status.png)

I started the previously created container using:

```powershell
docker start alpine-lab
```

After checking its state, I noticed that the container had immediately stopped. Its status was displayed as Exited (0).

This behavior occurs because the container's main process terminates. The default command in the Alpine image is /bin/sh. Without an interactive terminal attached, the shell exits, causing the container to stop.

![Alpine Image](/zen/container_exit0.png)

To keep the container running in the background, I recreated it with a long-running process. In this configuration, ```sleep infinity``` runs as the container's main process (PID 1), preventing it from terminating automatically.

```powershell
# Remove previously created container
docker rm alpine-lab

# Create a persistent container
docker create --name alpine-lab alpine:latest sleep infinity

# Start the container
docker start alpine-lab

# Inspect container's status
docker ps
```

![Alpine Image](/zen/container.png)

### 3. Container Access and Inspection

#### Accessing the Container

After starting the alpine-lab container, I accessed its shell. 

The ```exec``` command runs a new process inside an already-running container. In this case, it launched an interactive shell 
(/bin/sh), allowing me to execute commands within the container without changing its main process.

```powershell
# Access the shell
docker exec -it alpine-lab /bin/sh

# Run Linux commands
ps
whoami
hostname
```

These commands allowed me to verify the current user, identify the container's hostname, and view running processes.

![Alpine Image](/zen/linux_commands.png)

#### Inspecting Container Configuration and State

To examine the container's configuration and runtime state, I used

```powershell
docker inspect alpine-lab
```

The command returns detailed information in JSON format. I focused on several fields

| Field | Value |
|---------|-------------|
| State.Status | running |
| State.Pid | 575 |
| Config.Image | alpine:latest |
| Config.CMD | "sleep", "infinity" |
| NetworkSettings.IPAddress | 172.17.0.2 |

#### Monitoring Container Processes

I used ```docker top``` to examine the processes running inside the container. The output showed the container's main process, sleep infinity, which kept the container running.

```powershell
docker top alpine-lab
```

| Field | Value |
|---------|-------------|
| uid | root |
| pid | 575 |
| cmd | sleep infinity |

#### Monitoring Resource Usage

To monitor the container's resource consumption, I ran:

```powershell
docker stats alpine-lab
```

| Field | Value |
|---------|-------------|
| NAME | alpine-lab |
| CPU % | 0.00 % |
| MEM USAGE / LIMIT | 1.602MiB / 7.607GiB |
| MEM % | 0.02% |
| NET I/O | 1.17kB / 126B |
| BLOCK IO | 28.7kB / 8.19kB |
| PIDS | 1 |

This command displayed live resource statistics, including CPU usage, memory consumption, network I/O, and block I/O.
I stopped the monitoring process using Ctrl+C.

#### Stopping and Removing the Container

After completing the inspection and monitoring tasks, I stopped the container:

```powershell
# Stop the container
docker stop alpine-lab

# Verify the container's state
docker ps -a
```

The container changed its state from Running to Exited. However, stopping a container does not remove it. Its configuration and writable filesystem layer remain available, allowing it to be started again.

Once the container was stopped, I removed it:

```powershell
# Remove the stopped container
docker rm alpine-lab

# Verify that the container has been removed
docker ps -a
```

After removal, the container no longer appeared in the container list. The Alpine image remained available locally because removing a container does not automatically delete the image it was created from.

## Container Lifecycle Management

Docker containers have a lifecycle that describes the different states a container can enter during its existence. Understanding these states and how to manage them is important for controlling container execution and maintaining a predictable environment.

#### Container Lifecycle States

A Docker container can exist in several states.

| State | Description |
|---------|-------------|
| Created | The container has been created from an image but has not started executing |
| Running | The container is actively executing its configured process |
| Paused | The processes inside the container have been temporarily suspended |
| Stopped (Exited) | The container's main process has terminated. The container still exists and can be started again |
| Removed | The container has been deleted and is no longer available |

#### Managing Container States

| Command | Description |
|---------|-------------|
| ```docker start``` | Starts an existing stopped container |
| ```docker stop``` | Gracefully stops a running container |
| ```docker restart``` | Stops and starts a container again |
| ```docker pause``` | Suspends all processes inside a running container |
| ```docker unpause``` | Resumes processes inside a paused container |
| ```docker kill``` | Immediately sends a termination signal to the container's main process |
| ```docker rm``` | Removes a stopped container |

#### Monitoring Container Status 

To manage containers effectively, it is important to monitor their current state.

| Command | Description |
|---------|-------------|
| ```docker ps``` | Display running containers |
| ```docker ps -a``` | Display all containers, including stopped ones |
| ```docker inspect <container_id>``` | Display detailed information about a specific container |

## Challenges and Troubleshooting

During the lab, I encountered an issue related to the lifecycle of an Alpine container. Investigating this behavior helped me understand why Docker containers stop when their primary process terminates.

### Alpine Container Exits Immediately After Starting

#### Problem:

I created a container from the Alpine image and attempted to start it. However, the container immediately changed its state to Exited.

#### Initial Approach:

I created and started the container using:

```powershell
docker create --name alpine-lab alpine:latest
docker start alpine-lab
```

After checking the container status, I noticed that the container was no longer running:

```powershell
docker ps -a
```

#### Investigation:

The issue was caused by the default command configured in the Alpine image.

Docker containers do not run indefinitely by default. A container remains running only while its primary process is active. When that process terminates, the container exits.

In this case, the default command did not provide a long-running process, so the container stopped immediately after starting.

#### Resolution:

I removed the original container, recreated it with the sleep infinity command, and started the container again:

```powershell
docker rm alpine-lab
docker create --name alpine-lab alpine:latest sleep infinity
docker start alpine-lab
```
After checking its status with ```docker ps```, I confirmed that the container remained in the Running state.

#### Result:

The container now had a long-running primary process, preventing it from exiting immediately.

## Lessons Learned

This issue helped me understand several important Docker concepts:

- A container is not a virtual machine and does not automatically run in the background indefinitely.
- The lifecycle of a container is directly tied to its primary process.
- When the primary process terminates, the container stops.
- The sleep infinity command can be used in lab environments to keep a container running while practicing Docker commands.
- The ```docker ps -a``` command is useful for identifying containers that have exited unexpectedly.