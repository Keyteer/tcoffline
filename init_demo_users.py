"""
Script to create demo users for TrakCare Offline Local
Creates admin and demo users with default credentials
"""
from app.db import SessionLocal
from app.models import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

def create_demo_users():
    db = SessionLocal()
    try:
        # Create admin user
        admin = db.query(User).filter(User.username == 'admin').first()
        if not admin:
            admin = User(
                username='admin',
                hashed_password=pwd_context.hash('admin'),
                role='admin',
                nombre='Administrador',
                active=True,
                is_admin=True
            )
            db.add(admin)
            print('✓ Usuario admin creado (usuario: admin, contraseña: admin)')
        else:
            print('✓ Usuario admin ya existe')

        # Create demo user
        demo = db.query(User).filter(User.username == 'demo').first()
        if not demo:
            demo = User(
                username='demo',
                hashed_password=pwd_context.hash('demo'),
                role='medico',
                nombre='Usuario Demo',
                active=True,
                is_admin=False
            )
            db.add(demo)
            print('✓ Usuario demo creado (usuario: demo, contraseña: demo)')
        else:
            print('✓ Usuario demo ya existe')

        db.commit()
        print('\n✓ Usuarios demo creados exitosamente')
        print('  - Admin: usuario=admin, contraseña=admin')
        print('  - Demo:  usuario=demo, contraseña=demo')
    except Exception as e:
        print(f'[ERROR] Error al crear usuarios: {e}')
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    create_demo_users()
