## Auth

```
REDIS_USERNAME=default
REDIS_PASSWORD=test
```

## Issues

If you are run into the issue `cgroup mountpoint does not exist: unknown`:

```
sudo mkdir /sys/fs/cgroup/systemd
sudo mount -t cgroup -o none,name=systemd cgroup /sys/fs/cgroup/systemd
```
