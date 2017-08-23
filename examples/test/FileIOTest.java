import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;


public class FileIOTest {
	public static void main(String[] args) throws IOException {
		int i = 0,ret = 1;
		int size = 32;
		int bs = 1024*1024;
		long btime, wtime;

		if(args.length > 0) {
			bs = Integer.parseInt(args[0]);
		}

		File tfile = new File("a.txt");
		if(tfile.exists()) {
			tfile.delete();
		}

		tfile.createNewFile();		
		FileOutputStream fout = new FileOutputStream(tfile);
		FileInputStream fin = new FileInputStream(tfile);

		int count = size*1024*1024/bs;
		byte[] buf = new byte[bs];

		System.out.println("Total: " + size + "M, block: " + bs);

		btime = System.currentTimeMillis();
		while(i++ < count) {
			fout.write(buf);
		}
		wtime = System.currentTimeMillis() - btime;
		System.out.println("write: " + wtime + " ms");

		while(ret > 0) {
			ret = fin.read(buf);
		}
		wtime = System.currentTimeMillis() - wtime - btime;
		System.out.println("read: " + wtime + " ms");

		fout.close();
		fin.close();
	}
}
