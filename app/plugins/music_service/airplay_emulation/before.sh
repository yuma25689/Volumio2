#!/bin/bash

/usr/bin/mpc stop
#/bin/node /volumio/wsclient.js setVolatile
wget http://localhost:3000/api/v1/startAirPlaySession


