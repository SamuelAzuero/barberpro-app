"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- INTERFACES DE TU BASE DE DATOS (SUPABASE) ---
interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  appointment_time: string;
  status: "pending" | "completed" | "cancelled";
  total_price: number;
  payment_method?: "efectivo" | "transferencia";
  services: { name: string } | null;
}

interface WaitingCustomer {
  id: string;
  customer_name: string;
  customer_phone: string;
  desired_date: string;
}

interface BlockedSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes?: number;
}

interface FinancialTransaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: "service_sale" | "product_sale" | "supplies" | "rent" | "services_fixed" | "other";
  description: string;
  payment_method: "efectivo" | "transferencia";
  created_at: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  
  // --- ESTADO DE PESTAÑAS ---
  const [activeTab, setActiveTab] = useState<"citas" | "espera" | "bloqueos" | "servicios" | "inventario" | "finanzas" | "clientes" | "informes" | "ajustes">("citas");
  const [loading, setLoading] = useState(true);

  // --- ARRAYS DE ESTADO GENERAL ---
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingCustomer[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

  // --- FILTROS Y ALERTAS ---
  const [filterDate, setFilterDate] = useState("");
  const [alertWaiting, setAlertWaiting] = useState<WaitingCustomer | null>(null);

  // --- FORMULARIO: BLOQUEOS ---
  const [blockDate, setBlockDate] = useState("");
  const [lockType, setLockType] = useState<"completo" | "horas">("completo");
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [blockReason, setBlockReason] = useState("");

  // --- FORMULARIO: SERVICIOS ---
  const [serName, setSerName] = useState("");
  const [serPrice, setSerPrice] = useState("");

  // --- FORMULARIO: INVENTARIO ---
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodStock, setProdStock] = useState("");

  // --- FORMULARIO: FINANZAS ---
  const [finType, setFinType] = useState<"income" | "expense">("income");
  const [finAmount, setFinAmount] = useState("");
  const [finCategory, setFinCategory] = useState<FinancialTransaction["category"]>("supplies");
  const [finDesc, setFinDesc] = useState("");
  const [finPaymentMethod, setFinPaymentMethod] = useState<"efectivo" | "transferencia">("efectivo");

  // --- CONTROL DE EGRESOS FIJOS ---
  const [rentMissing, setRentMissing] = useState(false);
  const RENT_AMOUNT_ESTIMATED = 800000; // Valor de arriendo por defecto modificable

  // --- FORMULARIO: AJUSTES ---
  const [shopStartTime, setShopStartTime] = useState("11:00");
  const [shopEndTime, setShopEndTime] = useState("18:00");
  const [slotDuration, setSlotDuration] = useState<number>(30);

  useEffect(() => {
    fetchAllData();
  }, []);

  // Verificar si ya se pagó el arriendo este mes para alertas rápidas
  useEffect(() => {
    if (transactions.length > 0) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const rentPaidThisMonth = transactions.some(t => {
        const tDate = new Date(t.created_at);
        return t.category === "rent" && 
               tDate.getMonth() === currentMonth && 
               tDate.getFullYear() === currentYear;
      });
      
      setRentMissing(!rentPaidThisMonth);
    }
  }, [transactions]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAppointments(),
      fetchWaitingList(),
      fetchBlockedSlots(),
      fetchServices(),
      fetchProducts(),
      fetchTransactions(),
      fetchSettings()
    ]);
    setLoading(false);
  };

  // --- METODOS DE OBTENCIÓN (FETCH) ---
  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`id, customer_name, customer_phone, appointment_date, appointment_time, status, total_price, payment_method, services ( name )`)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });
    if (!error && data) setAppointments(data as unknown as Appointment[]);
  };

  const fetchWaitingList = async () => {
    const { data, error } = await supabase.from("waiting_list").select("*").order("created_at", { ascending: true });
    if (!error && data) setWaitingList(data);
  };

  const fetchBlockedSlots = async () => {
    const { data, error } = await supabase.from("blocked_slots").select("*").order("date", { ascending: true });
    if (!error && data) setBlockedSlots(data);
  };

  const fetchServices = async () => {
    const { data, error } = await supabase.from("services").select("*").order("name", { ascending: true });
    if (!error && data) setServices(data);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });
    if (!error && data) setProducts(data);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase.from("financial_transactions").select("*").order("created_at", { ascending: false });
    if (!error && data) setTransactions(data);
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
    if (!error && data) {
      setShopStartTime(data.shop_start_time.substring(0, 5));
      setShopEndTime(data.shop_end_time.substring(0, 5));
      setSlotDuration(data.slot_duration_minutes);
    }
  };

  // --- ACCIONES: CITAS ---
  const handleCancelAppointment = async (id: string, date: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (!error) {
      const candidate = waitingList.find((w) => w.desired_date === date);
      if (candidate) setAlertWaiting(candidate);
      fetchAppointments();
    }
  };

  const handleCompleteAppointment = async (id: string, serviceName: string, price: number, method: "efectivo" | "transferencia") => {
    const { error } = await supabase.from("appointments").update({ status: "completed", payment_method: method }).eq("id", id);
    if (!error) {
      await supabase.from("financial_transactions").insert([{
        type: "income",
        amount: price,
        category: "service_sale",
        description: `Corte de cabello (${serviceName})`,
        payment_method: method
      }]);
      fetchAppointments();
      fetchTransactions();
    }
  };

  // --- ACCIONES: BLOQUEOS, SERVICIOS, INVENTARIO, FINANZAS Y AJUSTES ---
  const handleGuardarBloqueo = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalStartTime = lockType === "completo" ? "00:00:00" : `${blockStartTime}:00`;
    const finalEndTime = lockType === "completo" ? "23:59:00" : `${blockEndTime}:00`;
    const { error } = await supabase.from("blocked_slots").insert([
      { date: blockDate, start_time: finalStartTime, end_time: finalEndTime, reason: blockReason || "Bloqueado" }
    ]);
    if (!error) {
      setBlockDate(""); setBlockStartTime(""); setBlockEndTime(""); setBlockReason("");
      fetchBlockedSlots();
    }
  };

  const handleEliminarBloqueo = async (id: string) => {
    const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
    if (!error) fetchBlockedSlots();
  };

  const handleAgregarServicio = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("services").insert([{
      name: serName, price: parseFloat(serPrice)
    }]);
    if (!error) {
      setSerName(""); setSerPrice(""); fetchServices();
    }
  };

  const handleActualizarPrecioServicio = async (id: string, nuevoPrecio: number) => {
    if (nuevoPrecio < 0) return;
    const { error } = await supabase.from("services").update({ price: nuevoPrecio }).eq("id", id);
    if (!error) fetchServices();
  };

  const handleEliminarServicio = async (id: string) => {
    const confirmar = window.confirm("¿Seguro que deseas eliminar este servicio del menú? Las citas existentes podrían verse afectadas.");
    if (confirmar) {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (!error) fetchServices();
    }
  };

  const handleAgregarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("products").insert([{
      name: prodName, description: prodDesc || null, price: parseFloat(prodPrice), stock: parseInt(prodStock), is_active: true
    }]);
    if (!error) {
      setProdName(""); setProdDesc(""); setProdPrice(""); setProdStock(""); fetchProducts();
    }
  };

  const handleActualizarStock = async (id: string, nuevoStock: number) => {
    if (nuevoStock < 0) return;
    const { error } = await supabase.from("products").update({ stock: nuevoStock }).eq("id", id);
    if (!error) fetchProducts();
  };

  const handleVenderProducto = async (productoId: string, nombre: string, precio: number, cantidadAVender: number, metodoPago: "efectivo" | "transferencia") => {
    const producto = products.find(p => p.id === productoId);
    
    if (!producto || producto.stock < cantidadAVender) {
      alert("No hay suficiente stock para esta venta.");
      return;
    }

    const { error: errorStock } = await supabase
      .from("products")
      .update({ stock: producto.stock - cantidadAVender })
      .eq("id", productoId);

    if (!errorStock) {
      await supabase.from("financial_transactions").insert([{
        type: "income",
        amount: precio * cantidadAVender,
        category: "product_sale",
        description: `Venta en tienda: 1x ${nombre}`,
        payment_method: metodoPago
      }]);
      
      fetchProducts();
      fetchTransactions();
    }
  };

  const handleEliminarProducto = async (id: string) => {
    const confirmar = window.confirm("¿Seguro que deseas eliminar este producto de la vitrina? Esta acción no se puede deshacer.");
    if (confirmar) {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (!error) fetchProducts();
    }
  };

  const handleAgregarTransaccion = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("financial_transactions").insert([{
      type: finType, amount: parseFloat(finAmount), category: finCategory, description: finDesc, payment_method: finPaymentMethod
    }]);
    if (!error) {
      setFinAmount(""); setFinDesc(""); fetchTransactions();
    }
  };

  // Función específica para asentar el egreso fijo del mes rápidamente
  const handleAsentarEgresoFijo = async (categoria: "rent" | "services_fixed", concepto: string, monto: number) => {
    const { error } = await supabase.from("financial_transactions").insert([{
      type: "expense",
      amount: monto,
      category: categoria,
      description: concepto,
      payment_method: "efectivo"
    }]);

    if (!error) {
      alert(`Gasto fijo "${concepto}" registrado con éxito.`);
      fetchTransactions();
    }
  };

  const handleActualizarAjustes = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from("settings").select("id").limit(1).maybeSingle();
    if (data) {
      await supabase.from("settings").update({ shop_start_time: `${shopStartTime}:00`, shop_end_time: `${shopEndTime}:00`, slot_duration_minutes: slotDuration }).eq("id", data.id);
    } else {
      await supabase.from("settings").insert([{ shop_start_time: `${shopStartTime}:00`, shop_end_time: `${shopEndTime}:00`, slot_duration_minutes: slotDuration }]);
    }
    alert("Horario actualizado correctamente.");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  // --- LÓGICA DE EXPORTACIÓN CSV ---
  const downloadCSV = (filename: string, rows: Record<string, any>[]) => {
    if (!rows || !rows.length) {
      alert("No hay datos para exportar.");
      return;
    }
    const separator = ",";
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      "\n" +
      rows.map(row => {
        return keys.map(k => {
          let cell = row[k] === null || row[k] === undefined ? "" : row[k];
          cell = cell.toString().replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
          return cell;
        }).join(separator);
      }).join("\n");

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarFinanzas = () => {
    const data = transactions.map(t => ({
      Fecha: new Date(t.created_at).toLocaleDateString("es-CO"),
      Tipo: t.type === "income" ? "Ingreso" : "Egreso",
      Categoria: t.category,
      Descripcion: t.description,
      Metodo_Pago: t.payment_method,
      Monto: t.amount
    }));
    downloadCSV("Reporte_Finanzas", data);
  };

  const exportarCitas = () => {
    const data = appointments.map(a => ({
      Fecha: a.appointment_date,
      Hora: a.appointment_time,
      Cliente: a.customer_name,
      Telefono: a.customer_phone,
      Servicio: a.services?.name || "N/A",
      Estado: a.status,
      Metodo_Pago: a.payment_method || "N/A",
      Total: a.total_price
    }));
    downloadCSV("Reporte_Citas", data);
  };

  const exportarInventario = () => {
    const data = products.map(p => ({
      Producto: p.name,
      Descripcion: p.description || "",
      Precio: p.price,
      Stock_Actual: p.stock
    }));
    downloadCSV("Reporte_Inventario", data);
  };

  // --- LÓGICA DE FILTRADO Y CLIENTES ---
  const fechasConCitas = Array.from(new Set(appointments.map(c => c.appointment_date))).sort();
  const appointmentsFiltradas = filterDate
    ? appointments.filter((cita) => cita.appointment_date === filterDate)
    : appointments;

  const clientesMap = new Map();
  appointments.forEach(cita => {
    if (!clientesMap.has(cita.customer_phone)) {
      clientesMap.set(cita.customer_phone, { nombre: cita.customer_name, telefono: cita.customer_phone, visitas: 0, totalGastado: 0, ultimaVisita: cita.appointment_date });
    }
    const cliente = clientesMap.get(cita.customer_phone);
    if (cita.status === "completed") {
      cliente.visitas += 1;
      cliente.totalGastado += Number(cita.total_price);
    }
    if (new Date(cita.appointment_date) > new Date(cliente.ultimaVisita)) {
      cliente.ultimaVisita = cita.appointment_date;
    }
  });
  const clientesList = Array.from(clientesMap.values()).sort((a, b) => b.visitas - a.visitas);

  const exportarClientes = () => {
    const data = clientesList.map(c => ({
      Nombre: c.nombre,
      Telefono: c.telefono,
      Visitas_Completadas: c.visitas,
      Total_Gastado: c.totalGastado,
      Ultima_Visita: c.ultimaVisita
    }));
    downloadCSV("Reporte_Clientes", data);
  };

  // --- CÁLCULOS FINANCIEROS Y GRAFICAS ---
  const totalIngresos = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalEgresos = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const balanceNeto = totalIngresos - totalEgresos;

  const totalEfectivo = transactions.filter(t => t.payment_method === "efectivo").reduce((sum, t) => t.type === "income" ? sum + Number(t.amount) : sum - Number(t.amount), 0);
  const totalTransferencia = transactions.filter(t => t.payment_method === "transferencia").reduce((sum, t) => t.type === "income" ? sum + Number(t.amount) : sum - Number(t.amount), 0);

  const chartDataMap: Record<string, { date: string, Ingresos: number, Gastos: number }> = {};
  [...transactions].reverse().forEach(t => {
    const d = new Date(t.created_at).toLocaleDateString("es-CO", { day: '2-digit', month: 'short' });
    if (!chartDataMap[d]) chartDataMap[d] = { date: d, Ingresos: 0, Gastos: 0 };
    if (t.type === "income") chartDataMap[d].Ingresos += Number(t.amount);
    if (t.type === "expense") chartDataMap[d].Gastos += Number(t.amount);
  });
  const chartData = Object.values(chartDataMap).slice(-7);

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans pb-12">
      
      {/* NOTIFICACIÓN EMERGENTE LISTA DE ESPERA */}
      {alertWaiting && (
        <div className="fixed bottom-6 right-6 bg-zinc-950 border-2 border-emerald-500 p-6 rounded-2xl shadow-2xl max-w-sm z-50 animate-bounce">
          <h4 className="text-sm font-black text-emerald-400 uppercase tracking-wider">¡Cupo Libre Detectado!</h4>
          <p className="text-xs text-zinc-300 mt-2">
            <span className="font-bold text-white">{alertWaiting.customer_name}</span> espera turno el <span className="font-bold text-white">{alertWaiting.desired_date}</span>.
          </p>
          <div className="mt-4 flex gap-2">
            <a href={`https://wa.me/${alertWaiting.customer_phone.replace(/\s+/g, "")}`} target="_blank" onClick={() => setAlertWaiting(null)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex-1 text-center">Avisar por WhatsApp</a>
            <button onClick={() => setAlertWaiting(null)} className="text-xs text-zinc-500 hover:text-white px-2">Ignorar</button>
          </div>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-40">
        <div>
          <h1 className="text-xl font-black tracking-wider text-white">YHC CONTROL</h1>
          <p className="text-xs text-zinc-500">Panel Central de Operaciones</p>
        </div>

        {/* MENÚ DE TODAS LAS PESTAÑAS */}
        <div className="flex flex-wrap justify-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 gap-1">
          <button onClick={() => setActiveTab("citas")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "citas" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>📅 Turnos</button>
          <button onClick={() => setActiveTab("espera")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "espera" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>⏳ Lista ({waitingList.length})</button>
          <button onClick={() => setActiveTab("bloqueos")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "bloqueos" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>🚫 Bloqueos</button>
          <button onClick={() => setActiveTab("servicios")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "servicios" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>✂️ Servicios</button>
          <button onClick={() => setActiveTab("inventario")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "inventario" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>📦 Inventario</button>
          <button onClick={() => setActiveTab("finanzas")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "finanzas" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>💰 Finanzas</button>
          <button onClick={() => setActiveTab("clientes")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "clientes" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>👥 Clientes</button>
          <button onClick={() => setActiveTab("informes")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "informes" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>📊 Informes</button>
          <button onClick={() => setActiveTab("ajustes")} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "ajustes" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>⚙️ Ajustes</button>
        </div>

        <button onClick={handleLogout} className="bg-zinc-900 hover:bg-red-950/40 hover:text-red-400 border border-zinc-800 text-zinc-400 text-xs font-bold px-4 py-2 rounded-xl transition-all">Salir</button>
      </header>

      {/* CUERPO CENTRAL DE LA APLICACIÓN */}
      <main className="max-w-6xl mx-auto p-6">
        {loading ? (
          <p className="text-zinc-600 text-sm text-center py-20 animate-pulse">Sincronizando datos con Supabase...</p>
        ) : (
          <>
            {/* ================= PESTAÑA: TURNOS ================= */}
            {activeTab === "citas" && (
              <section className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl animate-fadeIn">
                <div className="flex flex-col mb-6">
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-white">Flujo General de Turnos</h2>
                    <p className="text-xs text-zinc-500">Selecciona un día para ver las citas programadas.</p>
                  </div>
                  <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    <button onClick={() => setFilterDate("")} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${!filterDate ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700"}`}>TODOS</button>
                    {fechasConCitas.map(date => {
                      const label = new Date(date + "T00:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase();
                      return (
                        <button key={date} onClick={() => setFilterDate(date)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterDate === date ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700"}`}>{label.replace('.', '')}</button>
                      );
                    })}
                  </div>
                </div>

                {appointmentsFiltradas.length === 0 ? (
                  <div className="border border-dashed border-zinc-900 rounded-xl p-12 text-center text-zinc-600 text-sm">No hay turnos registrados para esta selección.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-400">
                      <thead className="text-xs text-zinc-500 border-b border-zinc-900 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-2">Fecha / Hora</th>
                          <th className="py-3 px-2">Cliente</th>
                          <th className="py-3 px-2">Servicio</th>
                          <th className="py-3 px-2">Estado</th>
                          <th className="py-3 px-2 text-right">Acciones / Pago</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {appointmentsFiltradas.map((cita) => (
                          <tr key={cita.id} className="hover:bg-zinc-900/10 transition-colors">
                            <td className="py-4 px-2">
                              <p className="text-white font-bold">{cita.appointment_date}</p>
                              <p className="text-zinc-500 text-xs mt-0.5">{cita.appointment_time.substring(0, 5)} HS</p>
                            </td>
                            <td className="py-4 px-2">
                              <p className="text-white font-medium">{cita.customer_name}</p>
                              <a href={`https://wa.me/${cita.customer_phone.replace(/\s+/g, "")}`} target="_blank" className="text-emerald-400 text-xs hover:underline">💬 {cita.customer_phone}</a>
                            </td>
                            <td className="py-4 px-2 text-xs font-semibold text-zinc-300">
                              {cita.services?.name || "No especificado"} <br />
                              <span className="text-zinc-500">${Number(cita.total_price).toLocaleString("es-CO")}</span>
                            </td>
                            <td className="py-4 px-2">
                              {cita.status === "pending" && <span className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-medium">Pendiente</span>}
                              {cita.status === "completed" && <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">Atendido ({cita.payment_method})</span>}
                              {cita.status === "cancelled" && <span className="text-zinc-600 text-xs line-through">Cancelado</span>}
                            </td>
                            <td className="py-4 px-2 text-right">
                              {cita.status === "pending" && (
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex gap-1.5">
                                    <button onClick={() => handleCompleteAppointment(cita.id, cita.services?.name || "Servicio", cita.total_price, "efectivo")} className="bg-emerald-900/50 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-800 text-xs px-2 py-1 rounded font-bold transition-colors">💵 Efectivo</button>
                                    <button onClick={() => handleCompleteAppointment(cita.id, cita.services?.name || "Servicio", cita.total_price, "transferencia")} className="bg-blue-900/50 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-800 text-xs px-2 py-1 rounded font-bold transition-colors">📱 Transfer</button>
                                  </div>
                                  <button onClick={() => handleCancelAppointment(cita.id, cita.appointment_date)} className="text-zinc-500 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider">Cancelar Turno</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ================= PESTAÑA: LISTA DE ESPERA ================= */}
            {activeTab === "espera" && (
              <section className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl animate-fadeIn">
                <h2 className="text-lg font-bold text-white mb-2">Clientes en Espera de Espacio Libre</h2>
                <p className="text-xs text-zinc-500 mb-6">Lista ordenada de clientes interesados que aguardan cancelaciones.</p>
                {waitingList.length === 0 ? (
                  <p className="text-zinc-600 text-sm italic text-center py-12 border border-dashed border-zinc-900 rounded-xl">No hay registros en espera.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-400">
                      <thead className="text-xs text-zinc-500 border-b border-zinc-900 uppercase">
                        <tr><th className="py-3 px-2">Día Solicitado</th><th className="py-3 px-2">Cliente</th><th className="py-3 px-2 text-right">Contacto</th></tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {waitingList.map((w) => (
                          <tr key={w.id} className="hover:bg-zinc-900/10">
                            <td className="py-4 px-2 text-white font-bold">{w.desired_date}</td>
                            <td className="py-4 px-2 font-medium text-zinc-300">{w.customer_name}</td>
                            <td className="py-4 px-2 text-right"><a href={`https://wa.me/${w.customer_phone.replace(/\s+/g, "")}`} target="_blank" className="text-xs bg-zinc-900 text-emerald-400 border border-zinc-800 px-3 py-1.5 rounded-xl hover:bg-zinc-800 font-bold">💬 WhatsApp</a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ================= PESTAÑA: BLOQUEOS ================= */}
            {activeTab === "bloqueos" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
                <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl h-fit">
                  <h2 className="text-lg font-bold text-white mb-1">Bloquear Agenda</h2>
                  <p className="text-xs text-zinc-500 mb-6">Inhabilita rangos de tiempo de la vista pública.</p>
                  <form onSubmit={handleGuardarBloqueo} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">FECHA</label>
                      <input type="date" required value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">MODALIDAD</label>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                        <button type="button" onClick={() => setLockType("completo")} className={`py-2 text-xs font-bold rounded-lg ${lockType === "completo" ? "bg-blue-600 text-white" : "text-zinc-400"}`}>Todo el Día</button>
                        <button type="button" onClick={() => setLockType("horas")} className={`py-2 text-xs font-bold rounded-lg ${lockType === "horas" ? "bg-blue-600 text-white" : "text-zinc-400"}`}>Por Horas</button>
                      </div>
                    </div>
                    {lockType === "horas" && (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="time" required value={blockStartTime} onChange={(e) => setBlockStartTime(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-sm text-white [color-scheme:dark]" />
                        <input type="time" required value={blockEndTime} onChange={(e) => setBlockEndTime(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-sm text-white [color-scheme:dark]" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-2">MOTIVO</label>
                      <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Ej. Descanso, Cita médica" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl text-xs uppercase tracking-wider">Guardar Restricción</button>
                  </form>
                </div>
                <div className="md:col-span-2 bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl">
                  <h2 className="text-lg font-bold text-white mb-6">Bloqueos Activos</h2>
                  {blockedSlots.length === 0 ? <p className="text-zinc-600 text-sm italic">No hay bloqueos.</p> : (
                    <table className="w-full text-sm text-zinc-400">
                      <thead className="text-xs text-zinc-500 uppercase border-b border-zinc-900"><tr><th className="py-2 text-left">Fecha</th><th className="py-2 text-left">Rango</th><th className="py-2 text-right">Acción</th></tr></thead>
                      <tbody>
                        {blockedSlots.map((item) => (
                          <tr key={item.id} className="border-b border-zinc-900 hover:bg-zinc-900/10">
                            <td className="py-4 text-white font-bold">{item.date}</td>
                            <td className="py-4">{item.start_time.startsWith("00:00") && item.end_time.startsWith("23:59") ? <span className="text-red-400 text-xs bg-red-500/10 px-2 py-0.5 rounded-full">Día Completo</span> : <span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded-full">{item.start_time.substring(0,5)} - {item.end_time.substring(0,5)}</span>}</td>
                            <td className="py-4 text-right"><button onClick={() => handleEliminarBloqueo(item.id)} className="text-zinc-600 hover:text-red-400 text-xs font-bold">Desbloquear</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ================= PESTAÑA: SERVICIOS ================= */}
            {activeTab === "servicios" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
                <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl h-fit">
                  <h2 className="text-lg font-bold text-white mb-1">Nuevo Servicio</h2>
                  <p className="text-xs text-zinc-500 mb-6">Crea opciones de cortes o tratamientos para tus clientes.</p>
                  <form onSubmit={handleAgregarServicio} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">NOMBRE DEL SERVICIO</label>
                      <input type="text" required value={serName} onChange={(e) => setSerName(e.target.value)} placeholder="Ej. Corte de Cabello + Barba" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">PRECIO ($)</label>
                      <input type="number" required value={serPrice} onChange={(e) => setSerPrice(e.target.value)} placeholder="Monto base" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-sm text-white focus:outline-none [color-scheme:dark]" />
                    </div>
                    <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl text-xs uppercase tracking-wider">Registrar Servicio</button>
                  </form>
                </div>
                <div className="md:col-span-2 bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl">
                  <h2 className="text-lg font-bold text-white mb-6">Catálogo de Servicios Ofrecidos</h2>
                  {services.length === 0 ? <p className="text-zinc-600 text-sm italic">No hay servicios registrados en la base de datos.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-zinc-400">
                        <thead className="text-xs text-zinc-500 uppercase border-b border-zinc-900">
                          <tr>
                            <th className="py-2 px-1 text-left">Servicio</th>
                            <th className="py-2 px-1 text-center">Cambiar Precio Base</th>
                            <th className="py-2 px-1 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {services.map((s) => (
                            <tr key={s.id} className="hover:bg-zinc-900/10">
                              <td className="py-4 px-1 text-white font-bold">{s.name}</td>
                              <td className="py-4 px-1 text-center flex items-center justify-center gap-3">
                                <button onClick={() => handleActualizarPrecioServicio(s.id, s.price - 1000)} className="bg-zinc-900 border border-zinc-800 w-8 h-8 rounded-lg font-bold text-xs text-zinc-400 hover:text-white">-1k</button>
                                <span className="font-mono text-white font-bold text-sm bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">${Number(s.price).toLocaleString("es-CO")}</span>
                                <button onClick={() => handleActualizarPrecioServicio(s.id, s.price + 1000)} className="bg-zinc-900 border border-zinc-800 w-8 h-8 rounded-lg font-bold text-xs text-zinc-400 hover:text-white">+1k</button>
                              </td>
                              <td className="py-4 px-1 text-right">
                                <button onClick={() => handleEliminarServicio(s.id)} className="text-zinc-600 hover:text-red-400 text-xs font-bold uppercase tracking-wider">Eliminar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= PESTAÑA: INVENTARIO ================= */}
            {activeTab === "inventario" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
                <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl h-fit">
                  <h2 className="text-lg font-bold text-white mb-1">Nuevo Producto</h2>
                  <form onSubmit={handleAgregarProducto} className="space-y-4">
                    <div><label className="block text-xs font-semibold text-zinc-400 mb-1">NOMBRE</label><input type="text" required value={prodName} onChange={(e) => setProdName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white" /></div>
                    <div><label className="block text-xs font-semibold text-zinc-400 mb-1">PRECIO ($)</label><input type="number" required value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-sm text-white [color-scheme:dark]" /></div>
                    <div><label className="block text-xs font-semibold text-zinc-400 mb-1">STOCK INICIAL</label><input type="number" required value={prodStock} onChange={(e) => setProdStock(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-sm text-white [color-scheme:dark]" /></div>
                    <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl text-xs uppercase tracking-wider">Registrar Producto</button>
                  </form>
                </div>
                <div className="md:col-span-2 bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl">
                  <h2 className="text-lg font-bold text-white mb-6">Stock de Vitrina y Tiendita</h2>
                  {products.length === 0 ? <p className="text-zinc-600 text-sm italic">No hay productos.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-zinc-400">
                        <thead className="text-xs text-zinc-500 uppercase border-b border-zinc-900">
                          <tr>
                            <th className="py-2 px-1 text-left">Producto</th>
                            <th className="py-2 px-1 text-left">Precio</th>
                            <th className="py-2 px-1 text-center">Unidades</th>
                            <th className="py-2 px-1 text-right">Venta / Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {products.map((p) => (
                            <tr key={p.id} className="hover:bg-zinc-900/10">
                              <td className="py-4 px-1 text-white font-bold">{p.name}</td>
                              <td className="py-4 px-1 font-mono">${Number(p.price).toLocaleString("es-CO")}</td>
                              <td className="py-4 px-1 text-center flex items-center justify-center gap-2">
                                <button onClick={() => handleActualizarStock(p.id, p.stock - 1)} className="bg-zinc-900 border border-zinc-800 w-7 h-7 rounded-lg font-bold">-</button>
                                <span className={`font-mono text-sm font-bold w-6 text-center ${p.stock <= 3 ? "text-red-400 animate-pulse" : "text-white"}`}>{p.stock}</span>
                                <button onClick={() => handleActualizarStock(p.id, p.stock + 1)} className="bg-zinc-900 border border-zinc-800 w-7 h-7 rounded-lg font-bold">+</button>
                              </td>
                              <td className="py-4 px-1 text-right">
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex gap-1.5">
                                    <button 
                                      onClick={() => handleVenderProducto(p.id, p.name, p.price, 1, "efectivo")}
                                      className="bg-emerald-900/50 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-800 text-[10px] px-2 py-1 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={p.stock < 1}
                                    >
                                      🛒 EFECTIVO
                                    </button>
                                    <button 
                                      onClick={() => handleVenderProducto(p.id, p.name, p.price, 1, "transferencia")}
                                      className="bg-blue-900/50 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-800 text-[10px] px-2 py-1 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={p.stock < 1}
                                    >
                                      📱 TRANSFER
                                    </button>
                                  </div>
                                  <button onClick={() => handleEliminarProducto(p.id)} className="text-zinc-600 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider">Eliminar</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= PESTAÑA: FINANZAS ================= */}
            {activeTab === "finanzas" && (
              <div className="space-y-8 animate-fadeIn">
                
                {/* ALERTA INTELIGENTE DE CONTROL DE EGRESOS FIJOS */}
                {rentMissing && (
                  <div className="bg-amber-950/40 border border-amber-900/60 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">📌 Egreso Fijo Pendiente Detectado</h4>
                      <p className="text-xs text-zinc-400 mt-1">No se ha registrado el pago del arriendo correspondiente a este mes.</p>
                    </div>
                    <button 
                      onClick={() => handleAsentarEgresoFijo("rent", `Arriendo Local - Mes Actual`, RENT_AMOUNT_ESTIMATED)}
                      className="bg-amber-600 hover:bg-amber-500 text-black text-xs font-black px-4 py-2 rounded-xl transition-all uppercase tracking-wider"
                    >
                      Asentar Arriendo (${RENT_AMOUNT_ESTIMATED.toLocaleString("es-CO")})
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl"><p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Caja Fuerte (Total)</p><p className={`text-2xl font-black font-mono mt-1 ${balanceNeto >= 0 ? "text-white" : "text-red-500"}`}>${balanceNeto.toLocaleString("es-CO")}</p></div>
                  <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl"><p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Dinero Físico</p><p className="text-2xl font-black text-emerald-400 font-mono mt-1">${totalEfectivo.toLocaleString("es-CO")}</p></div>
                  <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl"><p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">En Bancos</p><p className="text-2xl font-black text-blue-400 font-mono mt-1">${totalTransferencia.toLocaleString("es-CO")}</p></div>
                  <div className="bg-zinc-950 border border-red-900/50 p-6 rounded-2xl"><p className="text-xs text-red-500/70 font-bold uppercase tracking-wider">Gastos Totales</p><p className="text-2xl font-black text-red-400 font-mono mt-1">-${totalEgresos.toLocaleString("es-CO")}</p></div>
                </div>

                <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl h-80">
                  <h2 className="text-sm font-bold text-white mb-6 uppercase tracking-wider">Flujo (7 días)</h2>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val / 1000}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="Ingresos" fill="#34d399" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl h-fit">
                    <h2 className="text-lg font-bold text-white mb-4">Registrar Movimiento</h2>
                    <form onSubmit={handleAgregarTransaccion} className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                        <button type="button" onClick={() => setFinType("income")} className={`py-2 text-xs font-bold rounded-lg ${finType === "income" ? "bg-emerald-600 text-white" : "text-zinc-400"}`}>Ingreso (+)</button>
                        <button type="button" onClick={() => setFinType("expense")} className={`py-2 text-xs font-bold rounded-lg ${finType === "expense" ? "bg-red-600 text-white" : "text-zinc-400"}`}>Gasto (-)</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" required value={finAmount} onChange={(e) => setFinAmount(e.target.value)} placeholder="Monto" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-sm text-white" />
                        <select value={finPaymentMethod} onChange={(e) => setFinPaymentMethod(e.target.value as any)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-sm text-white">
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transfer</option>
                        </select>
                      </div>
                      <select value={finCategory} onChange={(e) => setFinCategory(e.target.value as any)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-sm text-white">
                        <option value="supplies">Insumos</option>
                        <option value="rent">Arriendo (Fijo)</option>
                        <option value="services_fixed">Servicios Públicos (Fijo)</option>
                        <option value="service_sale">Venta Servicios</option>
                        <option value="product_sale">Venta Productos</option>
                        <option value="other">Otros</option>
                      </select>
                      <input type="text" required value={finDesc} onChange={(e) => setFinDesc(e.target.value)} placeholder="Concepto (Ej. Pago de luz)" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-sm text-white" />
                      <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl text-xs uppercase tracking-wider">Guardar Flujo</button>
                    </form>
                  </div>
                  <div className="md:col-span-2 bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl">
                    <h2 className="text-lg font-bold text-white mb-6">Libro de Contabilidad</h2>
                    {transactions.length === 0 ? <p className="text-zinc-600 text-sm italic">Sin movimientos.</p> : (
                      <div className="overflow-x-auto max-h-96 pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        <table className="w-full text-sm text-zinc-400">
                          <thead className="text-xs text-zinc-500 uppercase border-b border-zinc-900 sticky top-0 bg-zinc-950"><tr><th className="py-2 text-left">Concepto</th><th className="py-2 text-right">Monto</th></tr></thead>
                          <tbody className="divide-y divide-zinc-900">
                            {transactions.map((t) => (
                              <tr key={t.id} className="hover:bg-zinc-900/10">
                                <td className="py-4"><p className="text-white font-medium">{t.description}</p><p className="text-[10px] text-zinc-500 uppercase">{new Date(t.created_at).toLocaleDateString("es-CO")} • {t.category.replace("_", " ")}</p></td>
                                <td className={`py-4 text-right font-mono font-bold ${t.type === "income" ? "text-emerald-400" : "text-red-400"}`}>{t.type === "income" ? "+" : "-"} ${Number(t.amount).toLocaleString("es-CO")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= PESTAÑA: CLIENTES ================= */}
            {activeTab === "clientes" && (
              <section className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl animate-fadeIn">
                <h2 className="text-lg font-bold text-white mb-6">Directorio de Clientes</h2>
                {clientesList.length === 0 ? <p className="text-zinc-600 text-sm italic text-center py-12">No hay clientes.</p> : (
                  <table className="w-full text-left text-sm text-zinc-400">
                    <thead className="text-xs text-zinc-500 border-b border-zinc-900 uppercase"><tr><th className="py-3 px-2">Cliente</th><th className="py-3 px-2 text-center">Visitas</th><th className="py-3 px-2 text-right">Gastado</th></tr></thead>
                    <tbody className="divide-y divide-zinc-900">
                      {clientesList.map((c, i) => (
                        <tr key={i} className="hover:bg-zinc-900/10">
                          <td className="py-4 px-2"><p className="text-white font-bold">{c.nombre}</p><p className="text-zinc-500 text-xs">{c.telefono}</p></td>
                          <td className="py-4 px-2 text-center"><span className="bg-zinc-900 text-blue-400 border border-zinc-800 px-3 py-1 rounded-full font-bold">{c.visitas}</span></td>
                          <td className="py-4 px-2 text-right font-mono text-emerald-400 font-bold">${c.totalGastado.toLocaleString("es-CO")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {/* ================= PESTAÑA: INFORMES ================= */}
            {activeTab === "informes" && (
              <section className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl animate-fadeIn max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-white">Centro de Exportación</h2>
                  <p className="text-sm text-zinc-500 mt-2">Descarga la información de tu negocio en formato Excel (CSV) para auditoría o contabilidad.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center text-center hover:border-emerald-500/50 transition-colors">
                    <div className="text-3xl mb-3">💰</div>
                    <h3 className="text-white font-bold mb-1">Informe Financiero</h3>
                    <p className="text-xs text-zinc-400 mb-4">Ingresos, gastos y balances detallados de la caja.</p>
                    <button onClick={exportarFinanzas} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-6 rounded-lg w-full transition-colors">Descargar CSV</button>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center text-center hover:border-blue-500/50 transition-colors">
                    <div className="text-3xl mb-3">📅</div>
                    <h3 className="text-white font-bold mb-1">Historial de Citas</h3>
                    <p className="text-xs text-zinc-400 mb-4">Registro completo de todos los turnos agendados.</p>
                    <button onClick={exportarCitas} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-6 rounded-lg w-full transition-colors">Descargar CSV</button>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center text-center hover:border-purple-500/50 transition-colors">
                    <div className="text-3xl mb-3">👥</div>
                    <h3 className="text-white font-bold mb-1">Base de Clientes</h3>
                    <p className="text-xs text-zinc-400 mb-4">Lista de clientes ordenados por visitas y consumo.</p>
                    <button onClick={exportarClientes} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 px-6 rounded-lg w-full transition-colors">Descargar CSV</button>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center text-center hover:border-amber-500/50 transition-colors">
                    <div className="text-3xl mb-3">📦</div>
                    <h3 className="text-white font-bold mb-1">Inventario Actual</h3>
                    <p className="text-xs text-zinc-400 mb-4">Estado del stock y precios de tus productos de venta.</p>
                    <button onClick={exportarInventario} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2 px-6 rounded-lg w-full transition-colors">Descargar CSV</button>
                  </div>
                </div>
              </section>
            )}

            {/* ================= PESTAÑA: AJUSTES ================= */}
            {activeTab === "ajustes" && (
              <section className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl max-w-xl mx-auto animate-fadeIn">
                <h2 className="text-lg font-bold text-white mb-6">Ajustes de Horario Base</h2>
                <form onSubmit={handleActualizarAjustes} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-semibold text-zinc-400 mb-2">APERTURA</label><input type="time" required value={shopStartTime} onChange={(e) => setShopStartTime(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white [color-scheme:dark]" /></div>
                    <div><label className="block text-xs font-semibold text-zinc-400 mb-2">CIERRE</label><input type="time" required value={shopEndTime} onChange={(e) => setShopEndTime(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white [color-scheme:dark]" /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2">DURACIÓN DEL TURNO (MIN)</label>
                    <select value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white [color-scheme:dark]">
                      <option value={20}>20 Min</option><option value={30}>30 Min (Recomendado)</option><option value={40}>40 Min</option><option value={60}>1 Hora</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-white text-black font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-all">Guardar Configuración</button>
                </form>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}