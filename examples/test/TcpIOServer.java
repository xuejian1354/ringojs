import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;


public class TcpServer {
	public static void main(String args[]) throws IOException {
		@SuppressWarnings("resource")
		int port = 8088;
		ServerSocket server = new ServerSocket(port);

		System.out.println("Server listening start: " + port);

		while(true) {
			Socket socket = server.accept();
			InputStream in = socket.getInputStream();
			OutputStream out = socket.getOutputStream();

			byte[] rebuf = new byte[1024];
			in.read(rebuf);

			out.write("HTTP/1.1 200 OK\r\n\r\nHello World\r\n".getBytes("UTF-8"));
			out.close();
			in.close();
			socket.close();
		}
	}
}
