const os = require('os');
const { performance } = require('perf_hooks');

// Monitor de Node.js.
// Usa os/process nativos para CPU, RAM, heap, uptime, versión.
const nodeMonitor = {
  async recolectar() {
    const inicio = performance.now();

    // CPU: muestreo breve de carga (monitor real aproximado)
    const cpus = os.cpus();
    const delay = 100; // ms
    const cargaInicio = cpus.map((c) => c.times);
    await new Promise((r) => setTimeout(r, delay));
    const cpusFin = os.cpus();
    let idle = 0;
    let total = 0;
    cpusFin.forEach((cpu, i) => {
      const tIni = cargaInicio[i];
      const tFin = cpu.times;
      const idleDif = tFin.idle - tIni.idle;
      const totalDif = (tFin.user + tFin.nice + tFin.sys + tFin.idle + tFin.irq) -
        (tIni.user + tIni.nice + tIni.sys + tIni.idle + tIni.irq);
      idle += idleDif;
      total += totalDif;
    });
    const cpuPorcentaje = total > 0 ? Math.round(((total - idle) / total) * 100) : 0;

    const totalMem = os.totalmem();
    const libreMem = os.freemem();
    const usadaMem = totalMem - libreMem;

    const heap = process.memoryUsage();
    const fin = performance.now();

    return {
      version: process.version,
      uptimeSegundos: Math.round(process.uptime()),
      cpuPorcentaje,
      procesadores: cpus.length,
      ramTotalMB: Math.round(totalMem / (1024 * 1024)),
      ramUsadaMB: Math.round(usadaMem / (1024 * 1024)),
      ramPorcentaje: Math.round((usadaMem / totalMem) * 100),
      heapUsadoMB: Math.round(heap.heapUsed / (1024 * 1024)),
      heapTotalMB: Math.round(heap.heapTotal / (1024 * 1024)),
      memoriaProcessMB: Math.round(heap.rss / (1024 * 1024)),
      tiempoRespuestaMs: Math.round(fin - inicio),
    };
  },
};

module.exports = nodeMonitor;
