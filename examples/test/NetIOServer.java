import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.text.DecimalFormat;

public class NetIOServer {
	public static void main(String[] args) throws IOException {
		int port = 8088;

		@SuppressWarnings("resource")
		ServerSocket server = new ServerSocket(port);
		System.out.println("Server Start: " + port);

		int i, len;
		long btime, wtime;

		while(true) {
			Socket socket = server.accept();
			InputStream ins = socket.getInputStream();
			OutputStream outs = socket.getOutputStream();

			System.out.print("reading... ");
			btime = System.currentTimeMillis();
			len = 0;
			while(ins.read() != -1){
				len++;
			}
			wtime = System.currentTimeMillis() - btime;
			System.out.println(len + "," + wtime + " " + getSpeed(len, wtime) + " finished.");
			ins.close();

			i = 0;
			System.out.print("writing... ");
			while(i++ < len) {
				outs.write(i);
			}
			wtime = System.currentTimeMillis() - wtime - btime;
			System.out.println(len + "," + wtime + " " + getSpeed(len, wtime) + " finished.");
			outs.close();

			socket.close();
			System.out.println();
		}
	}

	public static String getSpeed(int size, long ms) {
		
		float res = (float)size/ms*1000;

		String dw;
		int xs;
		if(res < 1024) {
			dw = "B/s";
			xs = 1;
		}
		else if (res < 1024 * 1024) {
			dw = "KB/s";
			xs = 1024;
		}
		else if (res < 1024 * 1024 * 1024) {
			dw = "MB/s";
			xs = 1024 * 1024;
		}
		else {
			dw = "G/s";
			xs = 1024 * 1024 * 1024;
		}

		DecimalFormat df = new DecimalFormat("0.00");
		return df.format(res/xs) + " " + dw;
	}
}
