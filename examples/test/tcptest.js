var io = require('io');
var net = require('net');

var server = new net.ServerSocket();
server.bind('0.0.0.0', 8088);

console.log("Server start..");

while(true) {
	var socket = server.accept();
	var stream = new io.TextStream(socket.getStream(), {
	  'charset': 'US-ASCII'
	});

	var line;
	line = stream.readLine();
	//console.log(line);
	stream.writeLine("HTTP/1.1 200 OK\r\n\r\nHello World!\n");
	socket.close();
}

server.close();
