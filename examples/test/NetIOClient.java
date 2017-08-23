import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.net.UnknownHostException;

public class NetIOClient {
	public static void main(String[] args) throws UnknownHostException, IOException {
		int port = 8088;
		int size = 1024*1024;
		String addr = "127.0.0.1";
		if(args.length > 0) {
			addr = args[0];
		}

		if(args.length > 1) {
			size = Integer.parseInt(args[1]);
		}

		System.out.println("Connect to " + addr + ":" + port + ", size: " + size);

		Socket socket = new Socket(addr, port);
		InputStream ins = socket.getInputStream();
		OutputStream outs = socket.getOutputStream();

		int i = 0;
		while(i++ < size) {
			outs.write(i);
		}
		outs.close();

		while(ins.read() != -1);
		ins.close();

		socket.close();
	}
}
