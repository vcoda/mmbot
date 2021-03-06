# INSTALL 

## FreeBSD

* Install required packages

```
$ pkg install cmake git gcc 
```
(you will also need openssl development package, but this package was found already installed on FreeBSD 12)

* Add an user

```
$ adduser
```
(now answer the questions)

* Switch to the user

```
$ su <user>
$ cd ~
```

* download from git and perform update

```
$ git clone https://github.com/ondra-novak/mmbot.git
$ cd mmbot
$ ./update
```

* first run using ssh tunnel

```
$ bin/mmbot -p <tunnel_port> start
```


You should install a webserver, and proxy_pass to `/home/<user>/mmbot/run/mmbot.socket`

### Debian/Ubuntu

* Install required packages

```
$ apt update
$ apt install git cmake make g++ libssl-dev
```

* Add and user and switch

```
$ adduser --disabled-password <user>
$ su <user>
$ cd ~
```

* download from git and perform update		

```
$ git clone https://github.com/ondra-novak/mmbot.git
$ cd mmbot
$ ./update
```

* first run using ssh tunnel

```
$ bin/mmbot -p <tunnel_port> start
```

You should install a webserver, and proxy_pass to `/home/<user>/mmbot/run/mmbot.socket`


### Fedora/CentOS

* Install required packages

```
$ yum install git gcc-c++ openssl-devel cmake make
```

* Add and user and switch

```
$ adduser <user>
$ su <user>
$ cd ~
```

* download from git and perform update		

```
$ git clone https://github.com/ondra-novak/mmbot.git
$ cd mmbot
$ ./update
```

* first run using ssh tunnel

```
$ bin/mmbot -p <tunnel_port> start
```

You should install a webserver, and proxy_pass to `/home/<user>/mmbot/run/mmbot.socket`





## update to newest version

Just type ...  

```
$ ./update
```

... in the root directory of the project.

Note, you probably made changes in configuration files. If there is
some update in configuration files, they will be merged. However, if
the merge fails, you will need to manually merge changes and then 
mark the conflict resolved by calling

```
git add conf/<name of conf>
```

otherwise next update fails until the conflict is resolved.


## automatic start after reboot 

You can use crontab to initiate job after reboot

### Debian/Ubuntu

```
$ crontab -e
```
now append `@reboot /home/mmbot/mmbot/bin/mmbot start`
and save

(why such path? /home/<user>/<instdir>/bin/mmbot)

### FreeBSD

* Create a file under `/usr/local/etc/rc.d/mmbot.sh`
* Put following command to the file:

```
#!/bin/sh
su <user> -c "/home/<user>/mmbot/bin/mmbot start"
```


