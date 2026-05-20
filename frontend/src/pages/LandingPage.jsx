import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const PLANS = [
  {
    id: "basico",
    name: "Básico",
    price: 49,
    annual: 39,
    desc: "Para un solo edificio",
    color: "#0EA5E9",
    features: [
      "1 edificio",
      "Cuotas de mantenimiento",
      "Registro de pagos",
      "Gestión de morosos",
      "Avisos a propietarios",
      "1 usuario administrador",
      "Soporte por email",
    ],
    notIncluded: ["Portal propietarios", "Órdenes de trabajo", "Reportes avanzados"],
  },
  {
    id: "profesional",
    name: "Profesional",
    price: 99,
    annual: 79,
    desc: "Para administradoras con varios edificios",
    color: "#0EA5E9",
    popular: true,
    features: [
      "Hasta 5 edificios",
      "Portal para propietarios",
      "Órdenes de trabajo",
      "Gestión de proveedores",
      "Reserva de amenidades",
      "Control de visitas y garita",
      "Reportes financieros PDF",
      "5 usuarios incluidos",
    ],
    notIncluded: ["Edificios ilimitados"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    annual: 159,
    desc: "Para grandes administradoras",
    color: "#0EA5E9",
    features: [
      "Edificios ilimitados",
      "Usuarios ilimitados",
      "Presupuesto anual",
      "Actas de asamblea",
      "Ingresos extraordinarios",
      "Integración bancaria",
      "Soporte dedicado",
      "Onboarding presencial",
    ],
    notIncluded: [],
  },
];

const FEATURES = [
  { icon: "💳", title: "Cuotas y Cobros", desc: "Genera cuotas automáticas por coeficiente, registra pagos en tiempo real y envía estados de cuenta a cada propietario." },
  { icon: "⚠️", title: "Control de Morosos", desc: "Identifica unidades en mora, aplica intereses automáticamente y genera cartas de cobro con un clic." },
  { icon: "🏠", title: "Portal del Propietario", desc: "Cada propietario accede a su estado de cuenta, avisos, actas y reservas desde el celular o computadora." },
  { icon: "🔧", title: "Órdenes de Trabajo", desc: "Gestiona mantenimientos, reparaciones y proveedores. Seguimiento de cada orden desde la solicitud hasta el cierre." },
  { icon: "🔒", title: "Control de Garita", desc: "Registro de visitas con QR, validación de acceso para propietarios y notificaciones en tiempo real." },
  { icon: "📊", title: "Reportes Financieros", desc: "Balance de ingresos vs gastos, fondo de reserva, presupuesto anual y estados financieros exportables en PDF." },
];

const TESTIMONIALS = [
  { name: "Arq. Marisol Quesada", role: "Administradora, Torre Pacific Heights", text: "Antes pasaba horas cuadrando las cuotas en Excel. Ahora el sistema genera todo automáticamente y los propietarios pueden ver su estado de cuenta ellos mismos.", avatar: "MQ" },
  { name: "Ing. Héctor Palma", role: "Junta Directiva, Residencias del Golf", text: "El portal de propietarios redujo los mensajes de WhatsApp a la mitad. Todos saben qué deben y cuándo vence. Las asambleas también son más ordenadas.", avatar: "HP" },
  { name: "Lcda. Diana Solís", role: "Administradora Inmobiliaria, 4 edificios", text: "Manejar 4 edificios desde un solo panel es exactamente lo que necesitaba. Los reportes financieros los presento directo en la asamblea.", avatar: "DS" },
];

const FAQS = [
  { q: "¿Funciona para cualquier tipo de PH?", a: "Sí. PH Manager está diseñado para apartamentos, oficinas, locales comerciales y proyectos mixtos. El sistema calcula cuotas por coeficiente según los m² y tipo de unidad de cada propietario." },
  { q: "¿Cómo acceden los propietarios al portal?", a: "Cada propietario recibe un correo con sus credenciales. Desde el portal puede ver su estado de cuenta, historial de pagos, avisos, actas y hacer reservas de amenidades." },
  { q: "¿Puedo importar los datos de mi edificio actual?", a: "Sí. Importamos unidades, propietarios y saldos desde Excel. El proceso toma menos de un día." },
  { q: "¿El sistema maneja el fondo de reserva?", a: "Sí. Registras cada gasto del fondo de reserva y el sistema actualiza el balance automáticamente. También puedes proyectar gastos futuros en el presupuesto anual." },
  { q: "¿Hay período de prueba?", a: "Sí. 14 días de acceso completo sin tarjeta de crédito. Incluye soporte para configurar tu primer edificio." },
  { q: "¿Funciona en el celular?", a: "Sí. La plataforma es responsive y funciona en cualquier dispositivo. El portal del propietario está optimizado para móvil." },
];

export default function PHManagerLanding() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const pricingRef = useRef(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollToPricing = () => pricingRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#F0F5FF", color: "#111827", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --sky: #0EA5E9;
          --sky-dark: #0284C7;
          --blue: #1E40AF;
          --dark: #0F172A;
          --text: #111827;
          --muted: #6B7280;
        }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        .btn-sky {
          background: var(--sky); color: #fff; border: none; border-radius: 10px;
          padding: 13px 28px; font-size: 15px; font-weight: 700; cursor: pointer;
          font-family: 'Outfit', sans-serif; transition: all 0.18s ease;
          box-shadow: 0 4px 20px rgba(14,165,233,0.35);
        }
        .btn-sky:hover { background: var(--sky-dark); transform: translateY(-1px); }
        .btn-ghost {
          background: transparent; color: rgba(255,255,255,0.85); border: 1.5px solid rgba(255,255,255,0.2);
          border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: 'Outfit', sans-serif; transition: all 0.15s ease;
        }
        .btn-ghost:hover { border-color: var(--sky); color: var(--sky); }
        .btn-ghost-dark {
          background: transparent; color: var(--blue); border: 1.5px solid #BFDBFE;
          border-radius: 10px; padding: 9px 20px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'Outfit', sans-serif; transition: all 0.15s ease;
        }
        .btn-ghost-dark:hover { border-color: var(--sky); color: var(--sky); }
        .plan-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.1); }
        .faq-item { cursor: pointer; transition: background 0.15s; border-radius: 12px; }
        .faq-item:hover { background: #F3F4F6; }
        .feature-card { transition: all 0.2s ease; }
        .feature-card:hover { background: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.07); transform: translateY(-2px); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        .badge-popular {
          position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(135deg, #0EA5E9, #0284C7);
          color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 4px 16px; border-radius: 20px;
          white-space: nowrap; box-shadow: 0 4px 16px rgba(14,165,233,0.4);
        }
        .toggle-track { width: 44px; height: 24px; border-radius: 12px; background: #BFDBFE; position: relative; cursor: pointer; transition: background 0.2s; }
        .toggle-track.on { background: var(--sky); }
        .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
        .toggle-track.on .toggle-thumb { left: 23px; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.96)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "none",
        padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.25s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff" }}>PH</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: scrolled ? "#1E40AF" : "#fff", letterSpacing: "-0.02em" }}>
            PH <span style={{ color: "#0EA5E9" }}>Manager</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          <a href="https://gestarsoft.com"
            style={{ fontSize: 13, fontWeight: 600, color: scrolled ? "#0EA5E9" : "rgba(14,165,233,0.85)", textDecoration: "none", transition: "color 0.15s" }}
          >← GestarSoft</a>
          {["Funciones", "Precios", "FAQ"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`}
              style={{ fontSize: 14, fontWeight: 600, color: scrolled ? "#4B5563" : "rgba(255,255,255,0.8)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => e.target.style.color = "#0EA5E9"}
              onMouseLeave={e => e.target.style.color = scrolled ? "#4B5563" : "rgba(255,255,255,0.8)"}
            >{item}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost-dark" onClick={() => navigate("/login")}>Iniciar sesión</button>
          <button className="btn-sky" style={{ padding: "9px 20px", fontSize: 13 }} onClick={scrollToPricing}>Empezar gratis</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(150deg, #0F172A 0%, #1E3A5F 45%, #1E40AF 100%)",
        position: "relative", overflow: "hidden", paddingTop: 80,
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        <div style={{ position: "absolute", top: "20%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: "15%", left: "8%", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div style={{ textAlign: "center", maxWidth: 820, padding: "0 24px", position: "relative", zIndex: 1 }}>
          <div className="fade-up" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.25)",
            borderRadius: 20, padding: "6px 18px", marginBottom: 32,
          }}>
            <span style={{ fontSize: 10, color: "#0EA5E9", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>🇵🇦 Administración de PH · Panamá</span>
          </div>

          <h1 className="fade-up" style={{
            fontSize: "clamp(34px, 5.5vw, 64px)", fontWeight: 900, color: "#FFFFFF",
            lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 24, animationDelay: "0.1s",
          }}>
            Administra tu edificio<br />
            <span style={{ background: "linear-gradient(90deg, #0EA5E9, #38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              sin complicaciones
            </span>
          </h1>

          <p className="fade-up" style={{
            fontSize: 18, color: "rgba(255,255,255,0.6)", lineHeight: 1.7,
            maxWidth: 560, margin: "0 auto 40px", animationDelay: "0.2s",
          }}>
            Cuotas, pagos, morosos, proveedores, portal de propietarios y control de garita — todo en una plataforma diseñada para la gestión de Propiedades Horizontales en Panamá.
          </p>

          <div className="fade-up" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.3s" }}>
            <button className="btn-sky" style={{ fontSize: 16, padding: "15px 36px" }} onClick={scrollToPricing}>
              Empezar 14 días gratis
            </button>
            <button className="btn-ghost" style={{ fontSize: 16, padding: "15px 32px" }} onClick={() => navigate("/login")}>
              Iniciar sesión →
            </button>
          </div>

          <div className="fade-up" style={{ marginTop: 48, display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.4s" }}>
            {[["Cuotas", "Automáticas"], ["Portal", "Propietarios"], ["Garita", "Digital"], ["PDF", "Reportes"]].map(([t, s]) => (
              <div key={t} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0EA5E9", fontFamily: "'DM Mono', monospace" }}>{t}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.06em" }}>{s}</div>
              </div>
            ))}
          </div>

          {/* Dashboard mockup */}
          <div style={{ marginTop: 56, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 40px 120px rgba(0,0,0,0.5)", background: "#111620" }}>
            <div style={{ background: "#0D1117", padding: "10px 16px", display: "flex", gap: 6, alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["#FF6B6B", "#F5A623", "#0EA5E9"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 18, marginLeft: 8, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>ph.gestarsoft.com/edificios</span>
              </div>
            </div>
            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[
                { l: "Unidades al día", v: "38/42", c: "#0EA5E9" },
                { l: "Morosos", v: "4", c: "#FF6B6B" },
                { l: "Recaudado", v: "B/.3,840", c: "#10B981" },
                { l: "Fondo Reserva", v: "B/.12K", c: "#F5A623" },
              ].map(k => (
                <div key={k.l} style={{ background: "#0D1117", borderRadius: 8, padding: "12px 14px", border: `1px solid ${k.c}18` }}>
                  <div style={{ fontSize: 9, color: "#4B5675", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{k.l}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#E8EDFF", fontFamily: "'DM Mono', monospace" }}>{k.v}</div>
                  <div style={{ marginTop: 6, height: 2, background: `${k.c}22`, borderRadius: 1 }}>
                    <div style={{ height: "100%", width: "80%", background: k.c, borderRadius: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funciones" style={{ padding: "100px 48px", background: "#F0F5FF" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ display: "inline-block", background: "#DBEAFE", color: "#1D4ED8", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, marginBottom: 16 }}>Funcionalidades</div>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: "#1E40AF", letterSpacing: "-0.025em", marginBottom: 14 }}>
              Todo lo que necesita tu edificio,<br />en una sola pantalla
            </h2>
            <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 500, margin: "0 auto" }}>Diseñado para administradoras profesionales y juntas directivas en Panamá.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card" style={{ background: "#E4EDFF", borderRadius: 14, padding: "28px 24px", border: "1px solid transparent" }}>
                <div style={{ fontSize: 26, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1E40AF", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precios" ref={pricingRef} style={{ padding: "100px 48px", background: "#0F172A" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", background: "rgba(14,165,233,0.12)", color: "#0EA5E9", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, marginBottom: 16 }}>Precios</div>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: "#fff", letterSpacing: "-0.025em", marginBottom: 16 }}>Planes para cada tamaño de edificio</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>Sin contratos. Cancela cuando quieras.</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 14, color: !annual ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>Mensual</span>
              <div className={`toggle-track${annual ? " on" : ""}`} onClick={() => setAnnual(!annual)}>
                <div className="toggle-thumb" />
              </div>
              <span style={{ fontSize: 14, color: annual ? "#0EA5E9" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                Anual <span style={{ fontSize: 11, background: "rgba(14,165,233,0.15)", color: "#0EA5E9", borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>−20%</span>
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, alignItems: "start" }}>
            {PLANS.map(plan => (
              <div key={plan.id} className="plan-card" style={{
                background: plan.popular ? "#fff" : "rgba(255,255,255,0.04)",
                border: plan.popular ? "2px solid #0EA5E9" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: "28px 22px", position: "relative",
              }}>
                {plan.popular && <div className="badge-popular">⭐ Más popular</div>}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: plan.popular ? "#1E40AF" : "#fff", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{plan.name}</div>
                  <p style={{ fontSize: 12, color: plan.popular ? "#6B7280" : "rgba(255,255,255,0.4)" }}>{plan.desc}</p>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 38, fontWeight: 900, color: plan.popular ? "#1E40AF" : "#fff", fontFamily: "'DM Mono', monospace" }}>
                      B/. {annual ? plan.annual : plan.price}
                    </span>
                    <span style={{ fontSize: 13, color: plan.popular ? "#9CA3AF" : "rgba(255,255,255,0.35)", marginBottom: 8 }}>/mes</span>
                  </div>
                  {annual && <div style={{ fontSize: 11, color: "#0EA5E9", fontWeight: 600 }}>Ahorras B/. {(plan.price - plan.annual) * 12}/año</div>}
                </div>
                <div style={{ fontSize: 11, color: "#0EA5E9", fontWeight: 700, marginBottom: 10, textAlign: "center" }}>✓ 14 días gratis · Sin tarjeta</div>
                <button
                  onClick={() => navigate(`/registro?plan=${plan.id}`)}
                  style={{
                    width: "100%", marginBottom: 20, padding: "12px", fontSize: 13, fontWeight: 700,
                    borderRadius: 10, border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.15)",
                    background: plan.popular ? "#0EA5E9" : "rgba(255,255,255,0.06)",
                    color: "#fff", cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                    boxShadow: plan.popular ? "0 4px 20px rgba(14,165,233,0.4)" : "none",
                    transition: "all 0.15s",
                  }}
                >Comenzar prueba gratis</button>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#0EA5E9", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 12, color: plan.popular ? "#374151" : "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12, flexShrink: 0 }}>✗</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAYMENT METHODS */}
      <section style={{ padding: "60px 48px 80px", background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 24 }}>Métodos de pago aceptados</p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "16px 28px", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🅿</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>PayPal</div>
              <div style={{ fontSize: 11, color: "#0EA5E9", fontWeight: 600 }}>Principal</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 28px", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>📱</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Yappy</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Contáctenos</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 28px", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🏦</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>ACH / Transferencia</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Contáctenos</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 20 }}>
            Para Yappy y transferencia bancaria, escríbanos a{" "}
            <a href={`https://wa.me/50765143637?text=Hola, quiero suscribirme a PH Manager`} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>WhatsApp</a>{" "}
            y habilitamos el acceso manualmente.
          </p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: "100px 48px", background: "#F0F5FF" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#1E40AF", letterSpacing: "-0.025em" }}>Lo que dicen los administradores</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #DBEAFE", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 18, color: "#0EA5E9", marginBottom: 12, letterSpacing: 2 }}>★★★★★</div>
                <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.7, marginBottom: 20 }}>"{t.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #1E40AF, #0EA5E9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1E40AF" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "100px 48px", background: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#1E40AF", letterSpacing: "-0.025em" }}>Preguntas frecuentes</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="faq-item" onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: "#0EA5E9", flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
                </div>
                {openFaq === i && <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7, marginTop: 10, paddingRight: 32 }}>{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "100px 48px", background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 60%, #1E40AF 100%)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 16 }}>Tu edificio, mejor administrado</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", marginBottom: 36, lineHeight: 1.7 }}>
            Únete a administradores de Propiedades Horizontales en Panamá que ya automatizan sus cuotas, morosos y comunicaciones con propietarios.
          </p>
          <button className="btn-sky" style={{ fontSize: 16, padding: "16px 44px" }} onClick={scrollToPricing}>
            Empezar 14 días gratis →
          </button>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 14 }}>Sin tarjeta · Sin contratos · Cancela cuando quieras</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#060C14", padding: "40px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #1E40AF, #0EA5E9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>PH</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>PH Manager · GestarSoft</span>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <a href="https://gestarsoft.com/terminos" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Términos</a>
          <a href="https://gestarsoft.com/privacidad" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Privacidad</a>
          <a href={`https://wa.me/50765143637?text=Hola, necesito soporte con PH Manager`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Soporte</a>
          <a href="https://www.linkedin.com/company/gestarsoft" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>LinkedIn</a>
          <a href="https://gestarsoft.com" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>GestarSoft.com</a>
        </div>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>© 2026 GestarSoft · Panamá</span>
      </footer>
    </div>
  );
}
