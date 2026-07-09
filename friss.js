friss
npm install express ws
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.json());

// Simulación de Base de Datos en memoria para el Mercado del Val
let pedidos = [];
let comerciosActivos = {
    "mesetarios": { nombre: "Mesetarios (Embutidos)", ws: null },
    "el-bombon": { nombre: "El Bombón (Pastelería)", ws: null },
    "veggs": { nombre: "Vegg's (Plant-based)", ws: null }
};
let ridersActivos = [];

// --- SERVIDOR HTTP (Para crear pedidos y ver estado) ---

// 1. Endpoint para que el cliente haga un pedido (¡Permite cesta única!)
app.post('/api/pedido', (req, res) => {
    const { cliente, direccion, productos } = req.body; 
    // Ejemplo productos: [{ comercio: 'mesetarios', item: 'Jamón' }, { comercio: 'veggs', item: 'Burguer' }]

    const nuevoPedido = {
        id: pedidos.length + 1,
        cliente,
        direccion,
        productos,
        estado: 'Recibido en Mercado del Val',
        fecha: new Date()
    };

    pedidos.push(nuevoPedido);

    // NOTIFICAR A CADA COMERCIO IMPLICADO VIA WEBSOCKET
    productos.forEach(p => {
        const comercio = comerciosActivos[p.comercio];
        if (comercio && comercio.ws) {
            comercio.ws.send(JSON.stringify({
                evento: 'NUEVO_PEDIDO_PRODUCTO',
                pedidoId: nuevoPedido.id,
                producto: p.item,
                direccion: nuevoPedido.direccion
            }));
        }
    });

    // NOTIFICAR A LOS RIDERS DISPONIBLES EN VALLADOLID
    ridersActivos.forEach(riderWs => {
        if (riderWs.readyState === WebSocket.OPEN) {
            riderWs.send(JSON.stringify({
                evento: 'NUEVO_VIAJE_DISPONIBLE',
                pedidoId: nuevoPedido.id,
                recogida: 'Mercado del Val (Hub)',
                destino: direccion
            }));
        }
    });

    res.status(201).json({ mensaje: "Pedido procesado y enviado al Mercado del Val", pedidoId: nuevoPedido.id });
});

// 2. Endpoint para ver el historial o estado de los pedidos
app.get('/api/pedidos', (req, res) => {
    res.json(pedidos);
});


// --- SERVIDOR WEBSOCKET (Tiempo real para Comercios y Riders) ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    // Detectamos quién se conecta por la URL (ej: /?rol=mesetarios o /?rol=rider)
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const rol = urlParams.get('rol');

    if (comerciosActivos[rol]) {
        comerciosActivos[rol].ws = ws;
        console.log(`🏪 Comercio conectado al Valshopper Hub: ${comerciosActivos[rol].nombre}`);
    } else if (rol === 'rider') {
        ridersActivos.push(ws);
        console.log(`🛵 Repartidor conectado en Valladolid listo para reparto.`);
    }

    // Escuchar acciones (ej: cuando el comercio dice "pedido listo" o el rider "pedido entregado")
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log(`[Evento recibido de ${rol}]:`, data);
        
        // Aquí añadiremos las lógicas de cambio de estado que me vayas pidiendo
    });

    ws.on('close', () => {
        if (comerciosActivos[rol]) comerciosActivos[rol].ws = null;
        ridersActivos = ridersActivos.filter(r => r !== ws);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Valshopper Engine corriendo en http://localhost:${PORT}`);
    console.log(`📍 Hub Centralizado: Mercado del Val, Valladolid.`);
});