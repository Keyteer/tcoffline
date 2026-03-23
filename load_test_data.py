"""
Script to load test data for TrakCare Offline Local
Generates 10 patients with multiple episodes, imaging results, allergies, lab results, and offline records
"""
from app.db import SessionLocal
from app.models import Episode, ClinicalNote, User
from datetime import datetime, timedelta
import random
import json

# Test data
FIRST_NAMES = ['Juan', 'María', 'Carlos', 'Ana', 'Pedro', 'Carmen', 'José', 'Isabel', 'Luis', 'Rosa']
LAST_NAMES = ['González', 'Rodríguez', 'López', 'Martínez', 'García', 'Fernández', 'Pérez', 'Sánchez', 'Díaz', 'Torres']

HOSPITALS = ['Hospital Central', 'Hospital Regional', 'Clínica Santa María', 'Hospital San Juan']
EPISODE_TYPES = ['Urgencia', 'Consulta', 'Hospitalización', 'Control']
ROOMS = ['101', '102', '201', '202', '301', '302', 'Box 1', 'Box 2', 'Box 3']
BEDS = ['A', 'B', 'C', '1', '2', '3']
STATES = ['Activo', 'En atención', 'Admitido', 'Alta']
PROFESSIONALS = ['Dr. García López', 'Dra. Martínez Silva', 'Dr. Fernández Ruiz', 'Dra. López Morales']

ALLERGIES = [
    'Penicilina',
    'Aspirina',
    'Ibuprofeno',
    'Diclofenaco',
    'Látex',
    'Polen',
    'Mariscos',
    'Frutos secos',
    'Sulfonamidas',
    'Contraste yodado'
]

MOTIVOS = [
    'Dolor abdominal',
    'Cefalea intensa',
    'Fiebre y malestar general',
    'Dolor torácico',
    'Disnea',
    'Control post-operatorio',
    'Mareos y vértigo',
    'Dolor lumbar',
    'Tos persistente',
    'Control de hipertensión'
]

LAB_TESTS = [
    {'name': 'Hemograma completo', 'values': [
        'Leucocitos: 7.5 x10^3/uL (4.0-11.0)',
        'Hemoglobina: 14.2 g/dL (12.0-16.0)',
        'Hematocrito: 42% (36-46)',
        'Plaquetas: 245 x10^3/uL (150-400)'
    ]},
    {'name': 'Perfil bioquímico', 'values': [
        'Glucosa: 98 mg/dL (70-100)',
        'Creatinina: 0.9 mg/dL (0.6-1.2)',
        'Urea: 32 mg/dL (15-40)',
        'Colesterol total: 195 mg/dL (<200)'
    ]},
    {'name': 'Función hepática', 'values': [
        'GOT (AST): 28 U/L (0-40)',
        'GPT (ALT): 32 U/L (0-40)',
        'Bilirrubina total: 0.8 mg/dL (0.3-1.2)',
        'Fosfatasa alcalina: 85 U/L (40-150)'
    ]},
    {'name': 'Electrolitos', 'values': [
        'Sodio: 140 mmol/L (136-145)',
        'Potasio: 4.2 mmol/L (3.5-5.1)',
        'Cloro: 102 mmol/L (98-107)',
        'Calcio: 9.5 mg/dL (8.5-10.5)'
    ]}
]

IMAGING_TESTS = [
    {
        'type': 'Radiografía de tórax',
        'result': 'Sin hallazgos patológicos. Silueta cardíaca normal. Campos pulmonares libres.',
        'conclusion': 'Estudio normal'
    },
    {
        'type': 'Ecografía abdominal',
        'result': 'Hígado de tamaño y ecoestructura normal. Vesícula sin litiasis. Páncreas sin alteraciones.',
        'conclusion': 'Estudio dentro de límites normales'
    },
    {
        'type': 'TAC cerebral',
        'result': 'No se observan lesiones ocupantes de espacio. Ventrículos de tamaño normal. Sin signos de hemorragia.',
        'conclusion': 'Sin hallazgos significativos'
    },
    {
        'type': 'Resonancia magnética lumbar',
        'result': 'Discreta protrusión discal L4-L5 sin compromiso radicular. Resto del estudio normal.',
        'conclusion': 'Protrusión discal L4-L5 leve'
    }
]

CLINICAL_NOTES_TEMPLATES = [
    'Paciente evoluciona favorablemente. Afebril. Signos vitales estables. Se indica continuar con tratamiento actual.',
    'Control post procedimiento. Sin complicaciones. Herida operatoria limpia y seca. Se dan indicaciones de alta.',
    'Paciente refiere mejoría del cuadro. Se realiza cambio de esquema terapéutico. Próximo control en 7 días.',
    'Evaluación de especialidad. Se solicitan exámenes complementarios. Pendiente resultados para definir conducta.',
    'Paciente ingresa por cuadro agudo. Se inicia manejo sintomático. En observación en sala de urgencias.'
]


def generate_rut():
    """Generate a valid Chilean RUT"""
    num = random.randint(10000000, 25000000)
    verification_digits = '0123456789K'

    # Calculate verification digit
    reversed_digits = str(num)[::-1]
    factors = [2, 3, 4, 5, 6, 7]
    total = sum(int(d) * factors[i % 6] for i, d in enumerate(reversed_digits))
    verification = 11 - (total % 11)
    if verification == 11:
        dv = '0'
    elif verification == 10:
        dv = 'K'
    else:
        dv = str(verification)

    # Format: 12.345.678-9
    rut_str = str(num)
    formatted = f"{rut_str[:-6]}.{rut_str[-6:-3]}.{rut_str[-3:]}-{dv}"
    return formatted


def generate_mrn():
    """Generate Medical Record Number"""
    return f"MRN{random.randint(100000, 999999)}"


def generate_episode_number():
    """Generate unique episode number"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_suffix = random.randint(1000, 9999)
    return f"EP{timestamp}{random_suffix}"


def generate_patient_history(patient_name, mrn):
    """Generate complete patient history with multiple episodes"""
    episodes = []
    base_date = datetime.now() - timedelta(days=random.randint(180, 730))

    # Generate 3-5 previous episodes
    num_previous_episodes = random.randint(3, 5)

    for i in range(num_previous_episodes):
        episode_date = base_date + timedelta(days=random.randint(30, 90) * i)

        # Select random allergies (0-3)
        num_allergies = random.randint(0, 3)
        patient_allergies = random.sample(ALLERGIES, num_allergies) if num_allergies > 0 else []

        # Select random lab tests (1-3)
        num_lab_tests = random.randint(1, 3)
        lab_results = random.sample(LAB_TESTS, num_lab_tests)

        # Select random imaging tests (1-2)
        num_imaging = random.randint(1, 2)
        imaging_results = random.sample(IMAGING_TESTS, num_imaging)

        # Prepare lab results in the format expected by frontend
        lab_results_formatted = []
        for test in lab_results:
            for i, value_str in enumerate(test['values']):
                # Parse value string like "Leucocitos: 7.5 x10^3/uL (4.0-11.0)"
                parts = value_str.split(':')
                if len(parts) == 2:
                    exam_name = parts[0].strip()
                    value_part = parts[1].strip()

                    # Extract value, unit, and range
                    value_with_range = value_part.split('(')
                    value_str_clean = value_with_range[0].strip()
                    range_ref = value_with_range[1].rstrip(')') if len(value_with_range) > 1 else ''

                    # Extract numeric value and unit
                    value_parts = value_str_clean.split()
                    value = value_parts[0] if value_parts else ''
                    unit = ' '.join(value_parts[1:]) if len(value_parts) > 1 else ''

                    lab_results_formatted.append({
                        'Tipo': test['name'],
                        'Examen': exam_name,
                        'Valor': value,
                        'Unidad': unit,
                        'RangoReferencia': range_ref,
                        'FechaHora': (episode_date + timedelta(hours=random.randint(1, 24))).strftime('%Y-%m-%d %H:%M:%S'),
                        'AbnormalFlag': 'Normal'
                    })

        # Prepare imaging results as encuentros (encounters)
        imaging_encounters = []
        for img in imaging_results:
            imaging_encounters.append({
                'FechaHora': (episode_date + timedelta(hours=random.randint(2, 48))).strftime('%Y-%m-%d %H:%M:%S'),
                'Medico': random.choice(['Dr. Ramírez (Radiólogo)', 'Dra. Silva (Radiología)', 'Dr. Campos (Imágenes)']),
                'Especialidad': 'Imagenología',
                'Tipo': 'Estudio de imagen',
                'MotivoConsulta': img['type'],
                'Diagnosticos': [{'Glosa': img['conclusion']}],
                'Medicamentos': [],
                'Indicaciones': [{'Glosa': img['result']}]
            })

        # Prepare clinical encounters from previous episodes
        clinical_encounters = [
            {
                'FechaHora': episode_date.strftime('%Y-%m-%d %H:%M:%S'),
                'Medico': random.choice(PROFESSIONALS),
                'Especialidad': random.choice(['Medicina General', 'Medicina Interna', 'Urgencia', 'Cardiología']),
                'Tipo': random.choice(EPISODE_TYPES),
                'MotivoConsulta': random.choice(MOTIVOS),
                'Diagnosticos': [
                    {'Glosa': diag} for diag in random.sample([
                        'Hipertensión arterial esencial',
                        'Diabetes mellitus tipo 2',
                        'Dislipidemia',
                        'Gastritis crónica',
                        'Hipotiroidismo',
                        'Dolor abdominal inespecífico',
                        'Cefalea tensional',
                        'Infección respiratoria alta'
                    ], random.randint(1, 2))
                ],
                'Medicamentos': [
                    {'Glosa': f"{med} {dosis} {freq}"} for med, dosis, freq in random.sample([
                        ('Losartán', '50mg', 'cada 24 horas'),
                        ('Metformina', '850mg', 'cada 12 horas'),
                        ('Atorvastatina', '20mg', 'cada 24 horas'),
                        ('Omeprazol', '20mg', 'cada 24 horas'),
                        ('Paracetamol', '500mg', 'cada 8 horas si dolor')
                    ], random.randint(1, 3))
                ],
                'Indicaciones': [
                    {'Glosa': ind} for ind in random.sample([
                        'Reposo relativo',
                        'Dieta hiposódica',
                        'Control en 7 días',
                        'Hidratación abundante',
                        'Evitar esfuerzos físicos'
                    ], random.randint(1, 2))
                ]
            }
        ]

        # Combine all encounters
        all_encounters = clinical_encounters + imaging_encounters

        episode_data = {
            'MRN': mrn,
            'NumEpisodio': generate_episode_number(),
            'RUN': generate_rut(),
            'Paciente': patient_name,
            'Nombre': patient_name,
            'FechaNacimiento': (datetime.now() - timedelta(days=random.randint(18*365, 80*365))).strftime('%Y-%m-%d'),
            'Sexo': random.choice(['M', 'F']),
            'Tipo': random.choice(EPISODE_TYPES),
            'FechaAtencion': episode_date.strftime('%Y-%m-%d %H:%M:%S'),
            'Hospital': random.choice(HOSPITALS),
            'Habitacion': random.choice(ROOMS),
            'Cama': random.choice(BEDS),
            'Ubicacion': f"{random.choice(ROOMS)}-{random.choice(BEDS)}",
            'Estado': random.choice(STATES),
            'Profesional': random.choice(PROFESSIONALS),
            'Antecedentes': {
                'Alergias': [
                    {
                        'Alergia': allergy,
                        'Tipo': 'Medicamentosa' if allergy in ['Penicilina', 'Aspirina', 'Ibuprofeno', 'Diclofenaco', 'Sulfonamidas', 'Contraste yodado'] else 'Ambiental/Alimentaria',
                        'Severidad': random.choice(['Leve', 'Moderada', 'Severa']),
                        'Fecha': (episode_date - timedelta(days=random.randint(30, 365))).strftime('%Y-%m-%d'),
                        'Activa': True
                    } for allergy in patient_allergies
                ],
                'Encuentros': all_encounters,
                'Resultados': lab_results_formatted,
                'RegistrosOffline': [
                    {
                        'FechaHora': (episode_date + timedelta(hours=random.randint(12, 72))).strftime('%Y-%m-%d %H:%M:%S'),
                        'Responsable': random.choice(PROFESSIONALS),
                        'Nota': random.choice(CLINICAL_NOTES_TEMPLATES)
                    } for _ in range(random.randint(2, 4))
                ]
            }
        }

        episodes.append(episode_data)

    return episodes


def load_test_data():
    """Load test data into database"""
    db = SessionLocal()
    try:
        print('Iniciando carga de datos de prueba...\n')

        # Get or create demo user for clinical notes
        demo_user = db.query(User).filter(User.username == 'demo').first()
        if not demo_user:
            print('[WARNING] Usuario demo no encontrado. Ejecute init_demo_users.py primero.')
            demo_user = User(
                username='demo',
                hashed_password='$2b$12$dummy',
                role='medico',
                nombre='Usuario Demo',
                active=True
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)

        # Generate 10 patients with multiple episodes
        total_episodes = 0
        total_notes = 0

        for i in range(10):
            patient_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)} {random.choice(LAST_NAMES)}"
            mrn = generate_mrn()

            print(f'[{i+1}/10] Generando paciente: {patient_name} (MRN: {mrn})')

            # Generate patient history with multiple episodes
            episodes = generate_patient_history(patient_name, mrn)

            for ep_data in episodes:
                # Create episode
                episode = Episode(
                    mrn=ep_data['MRN'],
                    num_episodio=ep_data['NumEpisodio'],
                    run=ep_data['RUN'],
                    paciente=ep_data['Paciente'],
                    fecha_nacimiento=datetime.strptime(ep_data['FechaNacimiento'], '%Y-%m-%d'),
                    sexo=ep_data['Sexo'],
                    tipo=ep_data['Tipo'],
                    fecha_atencion=datetime.strptime(ep_data['FechaAtencion'], '%Y-%m-%d %H:%M:%S'),
                    hospital=ep_data['Hospital'],
                    habitacion=ep_data['Habitacion'],
                    cama=ep_data['Cama'],
                    ubicacion=ep_data['Ubicacion'],
                    estado=ep_data['Estado'],
                    profesional=ep_data['Profesional'],
                    motivo_consulta=ep_data['Antecedentes']['Encuentros'][0]['MotivoConsulta'] if ep_data['Antecedentes']['Encuentros'] else '',
                    data_json=json.dumps(ep_data, ensure_ascii=False),
                    synced_flag=True  # Mark as synced since it's test data
                )
                db.add(episode)
                db.flush()  # Get episode ID

                # Create clinical notes from offline notes
                for nota_data in ep_data['Antecedentes'].get('RegistrosOffline', []):
                    clinical_note = ClinicalNote(
                        episode_id=episode.id,
                        author_user_id=demo_user.id,
                        author_nombre=nota_data['Responsable'],
                        note_text=nota_data['Nota'],
                        created_at=datetime.strptime(nota_data['FechaHora'], '%Y-%m-%d %H:%M:%S'),
                        synced_flag=True
                    )
                    db.add(clinical_note)
                    total_notes += 1

                total_episodes += 1

            print(f'  ✓ Creados {len(episodes)} episodios para {patient_name}')

        db.commit()

        print(f'\n✓ Datos de prueba cargados exitosamente')
        print(f'  - Pacientes: 10')
        print(f'  - Episodios totales: {total_episodes}')
        print(f'  - Notas clínicas: {total_notes}')
        print(f'\nCada paciente incluye:')
        print(f'  - 3-5 episodios anteriores')
        print(f'  - Alergias registradas')
        print(f'  - Resultados de laboratorio')
        print(f'  - Resultados de imágenes')
        print(f'  - Diagnósticos previos')
        print(f'  - Medicamentos habituales')
        print(f'  - Cirugías previas')
        print(f'  - Notas clínicas de registro offline')

    except Exception as e:
        print(f'[ERROR] Error al cargar datos: {e}')
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == '__main__':
    load_test_data()
