"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface DBAppointment {
  appointment_time: string;
  services: { duration_minutes: number } | null;
}

export default function AgendarCita() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  
  // State del formulario
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Disponibilidades cargadas desde Supabase para la fecha elegida
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // 1. Cargar servicios activos de la base de datos
  useEffect(() => {
    async function loadServices() {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true);
      if (!error && data) setServices(data);
    }
    loadServices();
  }, []);

  // 2. Generar próximos 14 días calendario para Yeison
  const nextDays = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      full: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('es-ES', { weekday: 'short' }),
      dayNumber: d.getDate(),
      dayOfWeek: d.getDay() // 0 = Domingo, 1 = Lunes, etc.
    };
  });

  // 3. Algoritmo para calcular horas libres reales sin colisiones
  useEffect(() => {
    if (!selectedDate || !selectedService) return;

    async function calculateSlots() {
      setLoading(true);
      const dayOfWeek = new Date(selectedDate + "T00:00:00").getDay();

      // A. Consultar horario base de Yeison para este día de la semana
      const { data: scheduleData } = await supabase
        .from("weekly_schedule")
        .select("*")
        .eq("day_of_week", dayOfWeek)
        .single();

      if (!scheduleData || !scheduleData.is_working) {
        setAvailableSlots([]);
        setLoading(false);
        return;
      }

      // B. Consultar citas ocupadas en este día
      const { data: appointments } = await supabase
        .from("appointments")
        .select("appointment_time, services(duration_minutes)")
        .eq("appointment_date", selectedDate)
        .not("status", "eq", "cancelled") as { data: DBAppointment[] | null };

      // C. Consultar bloqueos manuales de Yeison para este día
      const { data: blockedSlots } = await supabase
        .from("blocked_slots")
        .select("start_time, end_time")
        .eq("date", selectedDate);

      // Algoritmo matemático de cálculo de slots libres
      const timeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      const minutesToTime = (mins: number) => {
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
      };

      const startMins = timeToMinutes(scheduleData.start_time);
      const endMins = timeToMinutes(scheduleData.end_time);
      const prospectiveSlots: string[] = [];
      const serviceDuration = selectedService?.duration_minutes || 30;

      // Unir citas y bloqueos en un solo arreglo de rangos ocupados [inicio, fin] en minutos
      const occupiedRanges: { start: number; end: number }[] = [];

      if (appointments) {
        appointments.forEach((app) => {
          const appStart = timeToMinutes(app.appointment_time);
          const appDuration = app.services?.duration_minutes || 30;
          occupiedRanges.push({ start: appStart, end: appStart + appDuration });
        });
      }

      if (blockedSlots) {
        blockedSlots.forEach((block) => {
          const blockStart = timeToMinutes(block.start_time);
          const blockEnd = timeToMinutes(block.end_time);
          occupiedRanges.push({ start: blockStart, end: blockEnd });
        });
      }

      // Generar posiciones cada 30 minutos y comprobar si hay colisiones
      for (let current = startMins; current + serviceDuration <= endMins; current += 30) {
        const slotStart = current;
        const slotEnd = current + serviceDuration;

        const isOverlapping = occupiedRanges.some((range) => {
          return slotStart < range.end && range.start < slotEnd;
        });

        if (!isOverlapping) {
          prospectiveSlots.push(minutesToTime(current));
        }
      }

      setAvailableSlots(prospectiveSlots);
      setLoading(false);
    }

    calculateSlots();
  }, [selectedDate, selectedService]);

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setStep(2);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setStep(3);
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
    setStep(4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    setLoading(true);

    const appointmentPayload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      service_id: selectedService.id,
      appointment_date: selectedDate,
      appointment_time: selectedTime,
      total_price: selectedService.price,
      status: "pending"
    };

    const { error } = await supabase.from("appointments").insert([appointmentPayload]);

    if (error) {
      console.error(error);
      alert("Hubo un error al procesar tu cita. Intenta nuevamente.");
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full p-8 bg-[#0a0f1d] border border-emerald-500/50 rounded-3xl text-center shadow-[0_0_40px_rgba(16,185,129,0.15)]">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <h2 className="text-3xl font-extrabold mb-4">¡Cita Confirmada!</h2>
          <p className="text-zinc-400 mb-2">Has reservado: <strong className="text-white">{selectedService?.name}</strong></p>
          <p className="text-zinc-400 mb-6">Fecha: <strong className="text-white">{selectedDate}</strong> a las <strong className="text-white">{selectedTime} hs</strong>.</p>
          <Link href="/" className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-zinc-500 hover:text-white flex items-center gap-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Volver
          </Link>
          <div className="text-sm font-medium text-zinc-500">
            Paso <span className="text-blue-400">{step}</span> de 4
          </div>
        </div>

        <h2 className="text-4xl font-extrabold mb-2 tracking-tight">
          {step === 1 && "Elige tu Servicio."}
          {step === 2 && "Selecciona tu Día."}
          {step === 3 && "Selecciona tu Hora."}
          {step === 4 && "Confirma tu Reserva."}
        </h2>
        <p className="text-zinc-400 mb-10">
          {step === 1 && "Cada servicio incluye un tiempo específico de tratamiento."}
          {step === 2 && "Selecciona el día de tu preferencia de los próximos 14 días hábiles."}
          {step === 3 && `Horas hábiles calculadas en tiempo real para el día ${selectedDate}.`}
          {step === 4 && "Por favor déjanos tus datos de contacto."}
        </p>

        {/* PASO 1: SELECCIONAR SERVICIO */}
        {step === 1 && (
          <div className="space-y-4">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => handleSelectService(service)}
                className="w-full text-left bg-[#0a0f1d] border border-blue-900/20 hover:border-blue-500/50 p-6 rounded-2xl flex justify-between items-center transition-all hover:translate-x-1"
              >
                <div>
                  <h3 className="text-xl font-bold text-white">{service.name}</h3>
                  <p className="text-zinc-400 text-sm mt-1">⏳ Duración: {service.duration_minutes} minutos</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-blue-400">${Number(service.price).toLocaleString()} COP</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* PASO 2: CALENDARIO DE DÍAS */}
        {step === 2 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {nextDays.map((day) => {
              const isSunday = day.dayOfWeek === 0;
              return (
                <button
                  key={day.full}
                  disabled={isSunday}
                  onClick={() => handleSelectDate(day.full)}
                  className={`p-6 rounded-2xl flex flex-col items-center transition-all border ${
                    isSunday
                      ? "bg-[#05070f] border-zinc-900 text-zinc-600 cursor-not-allowed"
                      : "bg-[#0a0f1d] border-blue-900/20 hover:border-blue-500 hover:bg-blue-500/5 hover:-translate-y-1"
                  }`}
                >
                  <span className="text-zinc-400 text-xs uppercase font-bold mb-2">{day.dayName}</span>
                  <span className="text-4xl font-black text-white">{day.dayNumber}</span>
                  {isSunday && <span className="text-xs text-red-500/70 mt-1 font-semibold">Cerrado</span>}
                </button>
              );
            })}
            <div className="col-span-full mt-4">
              <button onClick={() => setStep(1)} className="text-sm text-zinc-500 hover:text-white underline">
                ← Volver a elegir servicio
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: SELECCIONAR HORA */}
        {step === 3 && (
          <div>
            {loading ? (
              <p className="text-center text-zinc-500">Verificando agenda de Yeison...</p>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-500 mb-4">No hay turnos disponibles para este día debido a bloqueos o citas ocupadas.</p>
                <button onClick={() => setStep(2)} className="text-blue-400 hover:underline">Intentar otro día</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {availableSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => handleSelectTime(time)}
                    className="bg-[#0a0f1d] border border-blue-900/20 hover:border-blue-500 hover:bg-blue-500/5 py-4 rounded-xl font-bold text-lg text-center transition-all"
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-8">
              <button onClick={() => setStep(2)} className="text-sm text-zinc-500 hover:text-white underline">
                ← Cambiar de día
              </button>
            </div>
          </div>
        )}

        {/* PASO 4: FORMULARIO CLIENTE */}
        {step === 4 && (
          <form onSubmit={handleSubmit} className="space-y-6 bg-[#0a0f1d] p-8 rounded-3xl border border-blue-900/30 shadow-xl">
            <div className="bg-blue-950/20 p-4 rounded-xl border border-blue-900/30 text-sm">
              <p className="text-zinc-400">Servicio: <strong className="text-white">{selectedService?.name}</strong></p>
              <p className="text-zinc-400 mt-1">Costo: <strong className="text-blue-400">${selectedService?.price.toLocaleString()} COP</strong></p>
              <p className="text-zinc-400 mt-1">Fecha y Hora: <strong className="text-white">{selectedDate} a las {selectedTime} hs</strong></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Nombre Completo</label>
              <input required type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Ej. Carlos Pérez" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Teléfono de Contacto</label>
              <input required type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Ej. 3123456789" />
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setStep(3)} className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl transition-all">
                Atrás
              </button>
              <button disabled={loading} type="submit" className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50">
                {loading ? "Procesando..." : "Confirmar Turno"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}