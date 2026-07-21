"""
RBAC — Matriz de permisos por rol.
Fuente de verdad: Blueprint Capítulo 6.
"""

# Los 26 permisos del sistema
PERMISSIONS = frozenset({
    # Pacientes
    "view_patients",
    "manage_patients",          # crear / editar
    "delete_patients",          # solo soft-delete

    # Citas
    "view_appointments",
    "manage_appointments",      # crear / editar / cancelar
    "complete_appointments",    # marcar como completada (inicia flujo de puntos)

    # Expediente clínico
    "view_clinical_records",
    "manage_clinical_records",  # escribir / editar dentro de ventana 24h
    "add_addenda",              # agregar addenda después de bloqueo

    # Tratamientos
    "view_treatments",
    "manage_treatments",        # crear/editar planes e ítems

    # Rewards
    "view_rewards",
    "manage_rewards",           # ajustes manuales de puntos

    # Fotografías
    "view_photos",
    "manage_photos",            # subir / eliminar

    # Dashboard
    "view_dashboard",
    "view_metrics",             # widget de métricas financieras (solo owner/admin)

    # Catálogo de procedimientos
    "view_catalog",
    "manage_catalog",

    # Configuración
    "manage_settings",          # datos de la clínica, horarios, festivos
    "view_settings",

    # Usuarios
    "view_users",
    "manage_users",             # crear / editar / activar / desactivar
    "reset_user_passwords",

    # Reportes (v0.2)
    "view_reports",

    # Auditoría (solo owner)
    "view_audit_logs",
})

# Permisos por rol — principio de mínimo privilegio
ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "clinic_owner": PERMISSIONS,  # acceso total

    "admin": frozenset({
        "view_patients", "manage_patients", "delete_patients",
        "view_appointments", "manage_appointments", "complete_appointments",
        "view_clinical_records", "manage_clinical_records", "add_addenda",
        "view_treatments", "manage_treatments",
        "view_rewards", "manage_rewards",
        "view_photos", "manage_photos",
        "view_dashboard", "view_metrics",
        "view_catalog", "manage_catalog",
        "manage_settings", "view_settings",
        "view_users", "manage_users", "reset_user_passwords",
        "view_reports",
    }),

    "dentist": frozenset({
        "view_patients", "manage_patients", "delete_patients",
        "view_appointments", "manage_appointments", "complete_appointments",
        "view_clinical_records", "manage_clinical_records", "add_addenda",
        "view_treatments", "manage_treatments",
        "view_rewards",
        "view_photos", "manage_photos",
        "view_dashboard",
        "view_catalog",
        "view_settings",
    }),

    "receptionist": frozenset({
        "view_patients", "manage_patients",
        "view_appointments", "manage_appointments",
        "view_clinical_records",
        "view_treatments",
        "view_rewards",
        "view_photos",
        "view_dashboard",
        "view_catalog",
        "view_settings",
    }),

    "assistant": frozenset({
        "view_patients",
        "view_appointments",
        "view_clinical_records",
        "view_treatments",
        "view_rewards",
        "view_photos",
        "view_dashboard",
        "view_catalog",
    }),
}


def has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, frozenset())
