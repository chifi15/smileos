import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Condiciones del Servicio — SmileOS",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-blue-600 hover:underline">← Volver</Link>

        <h1 className="mt-8 text-3xl font-bold">Condiciones del Servicio</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: 1 de septiembre de 2026</p>

        <Section title="1. Aceptación de los términos">
          <p>
            Al acceder o usar SmileOS, aceptas estas Condiciones del Servicio. Si no estás de acuerdo,
            no utilices el servicio. SmileOS es operado por Cristofher Munguía. Puedes contactarnos en{" "}
            <a href="mailto:cristofermunguia1588@gmail.com" className="text-blue-600 hover:underline">
              cristofermunguia1588@gmail.com
            </a>.
          </p>
        </Section>

        <Section title="2. Descripción del servicio">
          <p>
            SmileOS es un sistema de gestión para clínicas dentales que incluye:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Gestión de pacientes, citas y expedientes clínicos.</li>
            <li>Sincronización con Google Calendar.</li>
            <li>Asistente por WhatsApp para atención de pacientes.</li>
            <li>Módulos de finanzas, inventario y reportes.</li>
            <li>Programa de fidelidad Smile Rewards.</li>
          </ul>
        </Section>

        <Section title="3. Cuentas de usuario">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              La clínica es responsable de mantener la confidencialidad de las credenciales de acceso
              de su personal.
            </li>
            <li>
              Cada clínica administra sus propios usuarios y es responsable de las acciones realizadas
              con sus cuentas.
            </li>
            <li>
              Debes notificarnos de inmediato ante cualquier uso no autorizado de tu cuenta.
            </li>
          </ul>
        </Section>

        <Section title="4. Uso aceptable">
          <p>Al usar SmileOS te comprometes a:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Ingresar únicamente datos verídicos de pacientes y transacciones.</li>
            <li>Cumplir con las leyes de protección de datos y privacidad aplicables en tu país.</li>
            <li>No intentar acceder a datos de otras clínicas ni comprometer la seguridad del sistema.</li>
            <li>No usar el servicio para actividades ilegales o fraudulentas.</li>
          </ul>
        </Section>

        <Section title="5. Integraciones de terceros">
          <p>
            SmileOS se integra con servicios de terceros como Google Calendar y WhatsApp Cloud API.
            El uso de estas integraciones está sujeto a los términos de dichos servicios. SmileOS no
            es responsable por interrupciones o cambios en servicios de terceros.
          </p>
          <p>
            El uso que SmileOS hace de la información obtenida de Google APIs cumple con la{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Política de Datos de Usuario de los Servicios de la API de Google
            </a>
            , incluyendo los requisitos de Uso Limitado.
          </p>
        </Section>

        <Section title="6. Propiedad de los datos">
          <p>
            Los datos de la clínica y sus pacientes son propiedad exclusiva de la clínica. SmileOS
            actúa como procesador de datos. No vendemos ni transferimos datos de pacientes a terceros
            sin consentimiento explícito.
          </p>
        </Section>

        <Section title="7. Disponibilidad del servicio">
          <p>
            Nos esforzamos por mantener el servicio disponible de forma continua, pero no garantizamos
            disponibilidad ininterrumpida. Realizamos mantenimientos programados con previo aviso.
            No somos responsables por pérdidas derivadas de interrupciones del servicio.
          </p>
        </Section>

        <Section title="8. Limitación de responsabilidad">
          <p>
            SmileOS no será responsable por daños indirectos, incidentales o consecuentes derivados
            del uso del servicio. La responsabilidad total no excederá el monto pagado por el servicio
            en los últimos 3 meses.
          </p>
        </Section>

        <Section title="9. Terminación">
          <p>
            Cualquiera de las partes puede terminar el servicio en cualquier momento. Ante terminación,
            la clínica puede solicitar la exportación de sus datos antes de la eliminación definitiva.
          </p>
        </Section>

        <Section title="10. Cambios a las condiciones">
          <p>
            Podemos actualizar estas condiciones con notificación previa de 15 días por correo
            electrónico. El uso continuado del servicio tras la notificación implica aceptación
            de los nuevos términos.
          </p>
        </Section>

        <Section title="11. Ley aplicable">
          <p>
            Estas condiciones se rigen por las leyes de la República de Nicaragua. Cualquier disputa
            se resolverá mediante arbitraje o en los tribunales competentes de Managua, Nicaragua.
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
