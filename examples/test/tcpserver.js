var server = new java.net.ServerSocket(8088);
console.log("Tcp Server Start....");

while(true) {
    var socket = server.accept();
    var ibuff = new ByteArray(1024);
    socket.getInputStream().read(ibuff);
    var httpResponse = new java.lang.String("HTTP/1.1 200 OK\r\n\r\nHello World!\n");
    socket.getOutputStream().write(httpResponse.getBytes("UTF-8"));
    socket.close();
}

