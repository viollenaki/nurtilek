import sqlite3
from flask import Blueprint, request, jsonify, session, send_file
from io import BytesIO
import os
import bcrypt

user_bp = Blueprint('user', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@user_bp.route('/api/user/me', methods=['GET'])
def get_current_user():
    """Get information about the current logged in user"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    user_id = session['user_id']
    
    conn = get_db_connection()
    user = conn.execute('''
        SELECT id, nickname, created_at 
        FROM users WHERE id = ?
    ''', (user_id,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({"success": False, "message": "Пользователь не найден"}), 404
    
    return jsonify({
        "success": True,
        "user": {
            "id": user['id'],
            "nickname": user['nickname'],
            "created_at": user['created_at'],
            "has_profile_photo": is_profile_photo_exists(user_id)
        }
    })

@user_bp.route('/api/user/photo', methods=['GET'])
def get_user_photo():
    """Get user profile photo"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    user_id = session.get('user_id')
    
    conn = get_db_connection()
    photo_data = conn.execute('SELECT profile_photo FROM users WHERE id = ?', 
                           (user_id,)).fetchone()
    conn.close()
    
    if not photo_data or not photo_data['profile_photo']:
        # Возвращаем дефолтное изображение
        # Проверяем оба возможных пути к аватару по умолчанию
        default_photo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                       'static', 'images', 'avatar.png')
        if not os.path.exists(default_photo_path):
            default_photo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                          'static', 'images', 'avatar.png')
            # Если и этот файл не существует, создаем пустой аватар
            if not os.path.exists(default_photo_path):
                from PIL import Image, ImageDraw
                # Создаем директорию, если она не существует
                os.makedirs(os.path.dirname(default_photo_path), exist_ok=True)
                
                # Создаем простой placeholder-аватар
                img = Image.new('RGB', (200, 200), color=(73, 109, 137))
                d = ImageDraw.Draw(img)
                d.ellipse((50, 50, 150, 150), fill=(255, 255, 255))
                img.save(default_photo_path)
                print(f"Default avatar created at {default_photo_path}")
        
        return send_file(default_photo_path, mimetype='image/png')
    
    return send_file(
        BytesIO(photo_data['profile_photo']),
        mimetype='image/jpeg',
        as_attachment=False
    )

@user_bp.route('/api/user/by_id/<int:user_id>', methods=['GET'])
def get_user_by_id(user_id):
    """Get information about a specific user by ID"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    conn = get_db_connection()
    user = conn.execute('''
        SELECT id, nickname, created_at 
        FROM users WHERE id = ?
    ''', (user_id,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({"success": False, "message": "Пользователь не найден"}), 404
    
    return jsonify({
        "success": True,
        "user": {
            "id": user['id'],
            "nickname": user['nickname'],
            "created_at": user['created_at'],
            "has_profile_photo": is_profile_photo_exists(user_id)
        }
    })

@user_bp.route('/api/user/photo/<int:user_id>', methods=['GET'])
def get_user_photo_by_id(user_id):
    """Get profile photo of a specific user"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    conn = get_db_connection()
    photo_data = conn.execute('SELECT profile_photo FROM users WHERE id = ?', 
                           (user_id,)).fetchone()
    conn.close()
    
    if not photo_data or not photo_data['profile_photo']:
        # Возвращаем дефолтное изображение
        default_photo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                       'static', 'images', 'default_profile.png')
        return send_file(default_photo_path, mimetype='image/png')
    
    return send_file(
        BytesIO(photo_data['profile_photo']),
        mimetype='image/jpeg',
        as_attachment=False
    )

@user_bp.route('/api/user/update_profile', methods=['POST'])
def update_profile():
    """Update user profile information"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    user_id = session.get('user_id')
    
    # Обработка если данные в JSON
    if request.is_json:
        data = request.get_json()
        nickname = data.get('nickname')
        current_password = data.get('current_password')
        new_password = data.get('new_password')
    else:
        # Обработка если данные в form-data
        nickname = request.form.get('nickname')
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
    
    conn = get_db_connection()
    updates = []
    params = []
    message = "Профиль обновлен"
    
    # Проверяем, хочет ли пользователь изменить никнейм
    if nickname:
        # Проверяем, не занят ли уже этот никнейм другим пользователем
        existing = conn.execute('''
            SELECT id FROM users WHERE nickname = ? AND id != ?
        ''', (nickname, user_id)).fetchone()
        
        if existing:
            conn.close()
            return jsonify({"success": False, "message": "Никнейм уже занят"}), 409
        
        updates.append("nickname = ?")
        params.append(nickname)
        session['nickname'] = nickname
    
    # Проверяем, хочет ли пользователь изменить пароль
    if current_password and new_password:
        # Проверяем текущий пароль
        current_password_hash = conn.execute('''
            SELECT password FROM users WHERE id = ?
        ''', (user_id,)).fetchone()['password']
        
        if not bcrypt.checkpw(current_password.encode('utf-8'), current_password_hash.encode('utf-8')):
            conn.close()
            return jsonify({"success": False, "message": "Неверный текущий пароль"}), 401
        
        # Проверяем длину нового пароля
        if len(new_password) < 6:
            conn.close()
            return jsonify({"success": False, 
                         "message": "Новый пароль должен содержать не менее 6 символов"}), 400
        
        # Хешируем и сохраняем новый пароль
        new_password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        updates.append("password = ?")
        params.append(new_password_hash)
        message = "Профиль и пароль обновлены"
    
    # Обрабатываем фото профиля
    if 'profile_photo' in request.files:
        profile_photo = request.files['profile_photo']
        if profile_photo.filename:
            profile_photo_data = profile_photo.read()
            updates.append("profile_photo = ?")
            params.append(profile_photo_data)
    
    if not updates:
        conn.close()
        return jsonify({"success": False, "message": "Нет данных для обновления"}), 400
    
    # Выполняем обновление
    try:
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
        params.append(user_id)
        conn.execute(query, params)
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": message})
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при обновлении профиля: {str(e)}"}), 500

@user_bp.route('/api/user/search', methods=['GET'])
def search_users():
    """Search for users by nickname"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    query = request.args.get('query', '')
    if len(query) < 3:
        return jsonify({"success": False, "message": "Запрос должен содержать минимум 3 символа"}), 400
    
    conn = get_db_connection()
    users = conn.execute('''
        SELECT id, nickname, created_at 
        FROM users 
        WHERE nickname LIKE ? AND id != ?
        ORDER BY nickname
        LIMIT 20
    ''', (f"%{query}%", session.get('user_id'))).fetchall()
    
    results = []
    for user in users:
        results.append({
            "id": user['id'],
            "nickname": user['nickname'],
            "created_at": user['created_at'],
            "has_profile_photo": is_profile_photo_exists(user['id'])
        })
    
    conn.close()
    return jsonify({
        "success": True,
        "users": results
    })

def is_profile_photo_exists(user_id):
    """Check if user has a profile photo"""
    conn = get_db_connection()
    result = conn.execute('SELECT profile_photo FROM users WHERE id = ?', 
                       (user_id,)).fetchone()
    conn.close()
    return result is not None and result['profile_photo'] is not None
