import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.AbstractHandler;
import org.eclipse.jetty.server.bio.SocketConnector;


public class HttpHandler extends AbstractHandler {

       public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {

              response.setContentType("text/html;charset=utf-8");
              response.setStatus(HttpServletResponse.SC_OK);
              baseRequest.setHandled(true);
              response.getWriter().println("Hello World!");
       }

       public static void main(String[] args) throws Exception {

              Server server = new Server();

              SocketConnector connector = new SocketConnector();
              connector.setMaxIdleTime(1000 * 60 * 60);
              connector.setSoLingerTime(-1); 
              connector.setPort(8088);
              server.addConnector(connector);

              server.setHandler(new HttpHandler());
              server.start();
              System.out.println("Http Server Start...");
              server.join();
       }
}
