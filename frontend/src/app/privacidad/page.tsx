import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad — SmileOS",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Volver</Link>

        <h1 className="mt-8 text-3xl font-bold">Política de Privacidad</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: 1 de septiembre de 2026</p>

        <Section title="1. Quiénes somos">
          <p>
            SmileOS es un sistema de gestión para clínicas dentales desarrollado por Cristofher Munguía.
            Operamos el servicio disponible en <strong>smileos-six.vercel.app</strong>. Para consultas
            de privacidad puedes contactarnos en{" "}
            <a href="mailto:cristofermunguia1588@gmail.com" className="text-blue-600 hover:underline">
              cristofermunguia1588@gmail.com
            </a>.
          </p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Datos de la clínica:</strong> nombre, dirección, horarios de atención y configuración
              del sistema proporcionados durante el registro.
            </li>
            <li>
              <strong>Datos de usuarios del sistema:</strong> nombre, correo electrónico y contraseña
              cifrada del personal autorizado.
            </li>
            <li>
              <strong>Datos de pacientes:</strong> nombre, teléfono, fecha de nacimiento, historial de
              citas y registros clínicos ingresados por la clínica.
            </li>
            <li>
              <strong>Datos de Google Calendar:</strong> si la clínica conecta su cuenta de Google,
              almacenamos un token de acceso para sincronizar eventos del calendario. No leemos ni
              modificamos eventos que no hayan sido creados a través de SmileOS.
            </li>
            <li>
              <strong>Datos de uso:</strong> registros de actividad del sistema (qué usuario realizó
              qué acción) para auditoría interna de la clínica.
            </li>
          </ul>
        </Section>

        <Section title="3. Cómo usamos los datos">
          <ul className="list-disc pl-5 space-y-1">
            <li>Proveer y mantener el servicio de gestión clínica.</li>
            <li>Sincronizar citas con Google Calendar cuando la clínica lo autorice.</li>
            <li>Enviar recordatorios por WhatsApp a pacientes de la clínica (solo si está habilitado).</li>
            <li>Generar reportes y estadísticas para uso exclusivo de la clínica.</li>
            <li>No vendemos ni compartimos datos de pacientes con terceros.</li>
          </ul>
        </Section>

        <Section title="4. Servicios de terceros">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Google Calendar API:</strong> usada para sincronizar la agenda de la clínica.
              Su uso está sujeto a la{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Política de Privacidad de Google
              </a>.
            </li>
            <li>
              <strong>Meta WhatsApp Cloud API:</strong> usada para responder mensajes de pacientes.
              Solo procesamos mensajes entrantes; no iniciamos conversaciones.
            </li>
            <li>
              <strong>Supabase / PostgreSQL:</strong> base de datos alojada en servidores seguros.
            </li>
          </ul>
        </Section>

        <Section title="5. Almacenamiento y seguridad">
          <p>
            Los datos se almacenan en servidores con cifrado en reposo y en tránsito (HTTPS/TLS).
            El acceso está restringido por roles y todas las acciones quedan registradas en un log
            de auditoría. Los tokens de Google Calendar se almacenan cifrados y pueden ser revocados
            en cualquier momento desde Configuración → Google Calendar → Desconectar.
          </p>
        </Section>

        <Section title="6. Retención de datos">
          <p>
            Los datos de la clínica y sus pacientes se conservan mientras la cuenta esté activa.
            Al solicitar la eliminación de la cuenta, los datos son eliminados de nuestros sistemas
            en un plazo máximo de 30 días, salvo obligación legal de retención.
          </p>
        </Section>

        <Section title="7. Derechos del usuario">
          <p>
            Las clínicas pueden exportar, corregir o solicitar la eliminación de sus datos contactando
            a{" "}
            <a href="mailto:cristofermunguia1588@gmail.com" className="text-blue-600 hover:underline">
              cristofermunguia1588@gmail.com
            </a>.
          </p>
        </Section>

        <Section title="8. Cambios a esta política">
          <p>
            Notificaremos cambios significativos por correo electrónico al contacto registrado de la
            clínica con al menos 15 días de anticipación.
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-slate-200 text-sm text-slate-400">
          SmileOS · Sistema de Gestión para Clínicas Dentales
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">{title}</h2>
      <div className="text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
