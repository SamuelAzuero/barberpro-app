"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
}

interface Settings {
  shop_start_time: string;
  shop_end_time: string;
  slot_duration_minutes: number;
}

export default function PublicBooking() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Modo de compra independiente
  const [bookingMode, setBookingMode] = useState<"appointment" | "shop_only">("appointment");

  // Formulario de Usuario
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // Carrito de la Tiendita
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderSummary, setOrderSummary] = useState<string>("");

  // 1. Cargar Servicios, Productos en Vitrina y Configuración inicial
  useEffect(() => {
    async function fetchInitialData() {
      const [servicesRes, productsRes, settingsRes] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true),
        supabase.from("products").select("*").eq("is_active", true).gt("stock", 0).order("name", { ascending: true }),
        supabase.from("settings").select("*").limit(1).maybeSingle()
      ]);
      
      if (servicesRes.data) setServices(servicesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
      
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      } else {
        console.warn("Usando horario por defecto (falló la conexión a settings o no hay registros)");
        setSettings({
          shop_start_time: "11:00:00",
          shop_end_time: "18:00:00",
          slot_duration_minutes: 30
        });
      }
      
      setLoadingServices(false);
      setLoadingProducts(false);
    }
    fetchInitialData();
  }, []);

  // 2. Lógica inteligente de horarios disponibles
  useEffect(() => {
    async function fetchAvailability() {
      if (!date || !settings || bookingMode === "shop_only") return;
      setLoadingSlots(true);
      setTime(""); 

      const { data: appointments } = await supabase
        .from("appointments")
        .select("appointment_time")
        .eq("appointment_date", date)
        .neq("status", "cancelled");

      const { data: blockedSlots } = await supabase
        .from("blocked_slots")
        .select("start_time, end_time")
        .eq("date", date);

      const slots: string[] = [];
      let currentMinutes = timeToMinutes(settings.shop_start_time);
      const endMinutes = timeToMinutes(settings.shop_end_time);
      const interval = settings.slot_duration_minutes;

      while (currentMinutes < endMinutes) {
        const slotTimeStr = minutesToTime(currentMinutes);
        const slotTimeFull = `${slotTimeStr}:00`;

        const isBooked = appointments?.some(app => app.appointment_time === slotTimeFull);
        
        const isBlocked = blockedSlots?.some(block => {
          const blockStart = timeToMinutes(block.start_time);
          const blockEnd = timeToMinutes(block.end_time);
          return currentMinutes >= blockStart && currentMinutes < blockEnd;
        });

        if (!isBooked && !isBlocked) {
          slots.push(slotTimeStr);
        }

        currentMinutes += interval;
      }

      setAvailableSlots(slots);
      setLoadingSlots(false);
    }

    fetchAvailability();
  }, [date, settings, bookingMode]);

  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  // Gestión del Carrito
  const updateCartQuantity = (productId: string, delta: number, maxStock: number) => {
    const currentQty = cart[productId] || 0;
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      const { [productId]: _, ...rest } = cart;
      setCart(rest);
    } else if (newQty <= maxStock) {
      setCart({ ...cart, [productId]: newQty });
    }
  };

  // Cálculo de totales dinámicos
  const totalProductsPrice = Object.entries(cart).reduce((sum, [id, qty]) => {
    const prod = products.find(p => p.id === id);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  const totalFinalPrice = totalProductsPrice + (bookingMode === "appointment" && selectedService ? selectedService.price : 0);

  // Guardar en Base de Datos
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingMode === "appointment" && (!selectedService || !time)) {
      alert("Asegúrate de seleccionar un servicio y una hora libre.");
      return;
    }

    setSubmitting(true);

    // Formatear texto de productos comprados para registrarlo en la cita o transacción
    const productsListStr = Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find(prod => prod.id === id);
        return p ? `${qty}x ${p.name}` : "";
      })
      .filter(Boolean)
      .join(", ");

    try {
      // 1. Descontar stock de los productos comprados en Supabase
      for (const [id, qty] of Object.entries(cart)) {
        const prod = products.find(p => p.id === id);
        if (prod) {
          await supabase
            .from("products")
            .update({ stock: prod.stock - qty })
            .eq("id", id);
        }
      }

      if (bookingMode === "appointment") {
        // MODO CON TURNO: Se crea la cita anexando los detalles de la tienda
        const nuevaCita = {
          customer_name: name,
          customer_phone: phone,
          service_id: selectedService?.id,
          appointment_date: date,
          appointment_time: `${time}:00`,
          total_price: totalFinalPrice,
          status: "pending",
          payment_method: "efectivo"
        };
        
        // Si tienes una columna para texto extra de tienda en tu base de datos la puedes mapear,
        // de lo contrario, el precio acumulado alertará al barbero en el administrador.
        const { error } = await supabase.from("appointments").insert([nuevaCita]);
        if (error) throw error;
        setOrderSummary(`Tu cita para ${selectedService?.name} el ${date} a las ${time} ha sido registrada. Precio total (Corte + Vitrina): $${totalFinalPrice.toLocaleString("es-CO")}.`);

      } else {
        // MODO EXPRES (COMPRA APARTE): Genera una transacción directa en Finanzas marcada como pendiente de retiro
        const { error } = await supabase.from("financial_transactions").insert([{
          type: "income",
          amount: totalProductsPrice,
          category: "product_sale",
          description: `Compra virtual externa: ${productsListStr} - Cliente: ${name} (${phone})`,
          payment_method: "efectivo"
        }]);
        if (error) throw error;
        setOrderSummary(`Tu pedido express de [ ${productsListStr} ] fue enviado con éxito. Pasa a retirarlo por la barbería a tu conveniencia.`);
      }

      setSuccess(true);
    } catch (err: any) {
      alert("Hubo un error al procesar la solicitud: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center px-6 text-center animate-fadeIn">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 text-emerald-400 text-2xl">✓</div>
        <h2 className="text-2xl font-black tracking-wider uppercase mb-2">¡Operación Exitosa!</h2>
        <p className="text-zinc-400 text-sm max-w-sm mb-8">{orderSummary}</p>
        <button
          onClick={() => {
            setSuccess(false); setName(""); setPhone(""); setSelectedService(null); setDate(""); setTime(""); setCart({});
          }}
          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold px-6 py-3 rounded-xl text-xs uppercase tracking-wider border border-zinc-800 transition-all"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans pb-12">
      <header className="py-12 text-center border-b border-zinc-900 bg-zinc-950/20">
        <h1 className="text-3xl font-black tracking-widest text-white uppercase">Yeison HC <span className="text-blue-500">Barber</span></h1>
        <p className="text-zinc-500 text-xs mt-2 uppercase tracking-widest">Reserva tu turno o compra productos en línea</p>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-8">
        
        {/* SELECTOR DE MODALIDAD CENTRAL */}
        <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900 mb-8">
          <button type="button" onClick={() => setBookingMode("appointment")} className={`py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${bookingMode === "appointment" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-zinc-400 hover:text-white"}`}>📅 Agendar Turno</button>
          <button type="button" onClick={() => setBookingMode("shop_only")} className={`py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${bookingMode === "shop_only" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-zinc-400 hover:text-white"}`}>🛒 Solo Vitrina / Productos</button>
        </div>

        <form onSubmit={handleCheckout} className="space-y-8">
          
          {/* PASO 1: DATOS PERSONALES */}
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-sm font-black text-white tracking-wider uppercase mb-2 text-blue-500">1. Tus Datos</h3>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Nombre Completo</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Carlos Mendoza" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Celular / WhatsApp</label>
              <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 3001234567" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
          </div>

          {/* PASO 2: CONDICIONAL - AGENDAR CORTE */}
          {bookingMode === "appointment" && (
            <>
              <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl">
                <h3 className="text-sm font-black text-white tracking-wider uppercase mb-4 text-blue-500">2. Elige el Servicio</h3>
                {loadingServices ? (
                  <p className="text-zinc-600 text-xs animate-pulse">Cargando cortes disponibles...</p>
                ) : (
                  <div className="space-y-2">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setSelectedService(service)}
                        className={`w-full text-left p-4 rounded-xl border flex justify-between items-center transition-all ${
                          selectedService?.id === service.id ? "bg-blue-600/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <div>
                          <p className={`text-sm font-bold ${selectedService?.id === service.id ? "text-blue-400" : "text-white"}`}>{service.name}</p>
                          <p className="text-zinc-500 text-xs mt-0.5">⏱ {service.duration_minutes} min</p>
                        </div>
                        <p className="text-sm font-mono font-bold text-zinc-200">${Number(service.price).toLocaleString("es-CO")}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl space-y-4">
                <h3 className="text-sm font-black text-white tracking-wider uppercase mb-1 text-blue-500">3. Fecha y Hora Libre</h3>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">¿Qué día te sirve?</label>
                  <input type="date" required min={new Date().toISOString().split("T")[0]} value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
                </div>

                {date && (
                  <div className="pt-2 border-t border-zinc-800/50">
                    <label className="block text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Turnos Disponibles</label>
                    {loadingSlots ? (
                      <p className="text-zinc-500 text-xs animate-pulse">Calculando disponibilidad...</p>
                    ) : availableSlots.length === 0 ? (
                      <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-red-400 text-xs font-bold mb-2">Agenda llena para este día.</p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!name || !phone) return alert("Llena tu nombre y celular primero.");
                            await supabase.from("waiting_list").insert([{ customer_name: name, customer_phone: phone, desired_date: date }]);
                            alert("¡Anotado en la lista de espera!");
                          }}
                          className="text-xs bg-red-950/40 hover:bg-red-900/40 text-red-300 font-bold px-4 py-2 rounded-lg border border-red-900/50 transition-all"
                        >
                          Avisarme si se libera cupo
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlots.map((slot) => (
                          <button key={slot} type="button" onClick={() => setTime(slot)} className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${time === slot ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20" : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700"}`}>{slot}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* SECCIÓN DINÁMICA: LA TIENDITA VIRTUAL (VITRINA) */}
          <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-2xl shadow-xl">
            <div className="mb-4">
              <h3 className="text-sm font-black text-white tracking-wider uppercase text-blue-500">
                {bookingMode === "appointment" ? "4. ¿Quieres añadir algo de la Vitrina?" : "2. Selecciona tus Productos"}
              </h3>
              <p className="text-zinc-500 text-[11px] uppercase tracking-wider mt-1">Llévatelo directamente en la barbería</p>
            </div>

            {loadingProducts ? (
              <p className="text-zinc-600 text-xs animate-pulse">Cargando vitrina de productos...</p>
            ) : products.length === 0 ? (
              <p className="text-zinc-600 text-xs italic">No hay productos en vitrina actualmente.</p>
            ) : (
              <div className="space-y-3">
                {products.map((product) => {
                  const cartQty = cart[product.id] || 0;
                  return (
                    <div key={product.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-white">{product.name}</p>
                        <p className="text-zinc-500 text-xs font-mono font-bold mt-0.5">${Number(product.price).toLocaleString("es-CO")}</p>
                        <p className="text-[10px] text-zinc-600 mt-1 uppercase">Disponibles: {product.stock}</p>
                      </div>

                      {/* Control de cantidad en carrito */}
                      <div className="flex items-center gap-3 bg-black p-1 rounded-xl border border-zinc-850">
                        {cartQty > 0 ? (
                          <>
                            <button type="button" onClick={() => updateCartQuantity(product.id, -1, product.stock)} className="w-8 h-8 text-zinc-400 hover:text-white font-bold bg-zinc-900 rounded-lg text-sm">-</button>
                            <span className="font-mono text-sm font-bold text-white w-4 text-center">{cartQty}</span>
                            <button type="button" onClick={() => updateCartQuantity(product.id, 1, product.stock)} className="w-8 h-8 text-zinc-400 hover:text-white font-bold bg-zinc-900 rounded-lg text-sm" disabled={cartQty >= product.stock}>+</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => updateCartQuantity(product.id, 1, product.stock)} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-lg uppercase tracking-wider transition-colors">Añadir</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CAJA DE RESUMEN FINAL FIJA DE PRECIOS */}
          <div className="bg-zinc-950 border border-blue-900/30 p-6 rounded-2xl shadow-xl flex justify-between items-center">
            <div>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Total a pagar en barbería</p>
              <p className="text-2xl font-black font-mono text-white mt-1">${totalFinalPrice.toLocaleString("es-CO")}</p>
            </div>
            <button
              type="submit"
              disabled={submitting || (bookingMode === "appointment" && !time) || (bookingMode === "shop_only" && Object.keys(cart).length === 0)}
              className="bg-white hover:bg-zinc-200 text-black font-black px-6 py-4 rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Procesando..." : bookingMode === "appointment" ? "Confirmar Turno" : "Comprar Ahora"}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}