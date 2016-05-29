var io=require('socket.io-client');

var socket= io.connect('http://localhost:3000');

var data={
	"endpoint":"music_service/airplay_emulation",
	"method":"startAirplayPlayback",
	"data": {}
};

socket.emit('callMethod',data);
