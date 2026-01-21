const si = require('systeminformation');

console.log("Testing systeminformation memory...");
si.mem().then(data => {
    console.log("Memory Data:", data);
}).catch(error => {
    console.error("Memory Error:", error);
});

console.log("Testing CPU...");
si.currentLoad().then(data => {
    console.log("CPU Load:", data.currentLoad);
}).catch(e => console.error(e));
