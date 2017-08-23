var fs = require('fs');

var i=0;
var size = 32;
var bs = 1024*1024;
var buf = new ByteArray(bs);
var count = size*1024*1024/bs;

var btime, wtime;

console.log("Total: " + size + "M, block: " + bs);

var fouts = fs.open('b.txt', {write: true, binary: true});
btime = java.lang.System.currentTimeMillis();
while(i++ < count) {
	fouts.write(buf);
}
wtime = java.lang.System.currentTimeMillis() - btime;
console.log("write: " + wtime + " ms");
fouts.close();

var fins = fs.open('b.txt', {read: true, binary: true});
var ret = 1;
while(ret > 0) {
	var rdata = fins.read(bs);
	ret = rdata.length;
}
wtime = java.lang.System.currentTimeMillis() - wtime - btime;
console.log("read: " + wtime + " ms");
fins.close();

btime = java.lang.System.currentTimeMillis();
fs.copy('b.txt', 'c.txt');
wtime = java.lang.System.currentTimeMillis() - btime;
console.log("copy: " + wtime + " ms");