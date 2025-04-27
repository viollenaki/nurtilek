import sqlite3
from flask import Blueprint, request, jsonify, session, send_file
from io import BytesIO
import os
from datetime import datetime

chat_bp = Blueprint('chat', __name__)

def get_db_connection():
    """Create and return a database connection"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@chat_bp.route('/api/chats', methods=['GET'])
def get_user_chats():
    """Get list of all chats for the current user"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Получение личных диалогов пользователя
    dialogs = conn.execute('''
        SELECT c.id as chat_id, c.chat_name, c.chat_type, c.created_at,
               u.id as user_id, u.nickname,
               (SELECT content FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC LIMIT 1) as last_message,
               (SELECT timestamp FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC LIMIT 1) as last_message_time
        FROM chats c
        JOIN dialogs d ON c.id = d.chat_id
        JOIN users u ON (d.user1_id = u.id OR d.user2_id = u.id) AND u.id != ?
        WHERE d.user1_id = ? OR d.user2_id = ?
        ORDER BY last_message_time DESC NULLS LAST
    ''', (current_user_id, current_user_id, current_user_id)).fetchall()
    
    # Получение групповых чатов пользователя
    groups = conn.execute('''
        SELECT c.id as chat_id, c.chat_name, c.chat_type, c.created_at,
               gc.id as group_id, gc.description,
               (SELECT content FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC LIMIT 1) as last_message,
               (SELECT timestamp FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC LIMIT 1) as last_message_time
        FROM chats c
        JOIN group_chats gc ON c.id = gc.chat_id
        JOIN group_members gm ON gc.id = gm.group_chat_id
        WHERE gm.user_id = ? AND gm.status = 'active'
        ORDER BY last_message_time DESC NULLS LAST
    ''', (current_user_id,)).fetchall()
    
    # Преобразуем результаты в удобный формат
    chats_list = []
    
    for dialog in dialogs:
        chats_list.append({
            "id": dialog['chat_id'],
            "name": dialog['chat_name'] or dialog['nickname'],
            "type": "dialog",
            "participant_id": dialog['user_id'],
            "participant_name": dialog['nickname'],
            "last_message": dialog['last_message'],
            "last_message_time": dialog['last_message_time'],
            "created_at": dialog['created_at']
        })
    
    for group in groups:
        chats_list.append({
            "id": group['chat_id'],
            "name": group['chat_name'],
            "type": "group",
            "group_id": group['group_id'],
            "description": group['description'],
            "last_message": group['last_message'],
            "last_message_time": group['last_message_time'],
            "created_at": group['created_at']
        })
    
    # Сортируем чаты по времени последнего сообщения
    chats_list.sort(
        key=lambda x: x['last_message_time'] if x['last_message_time'] else x['created_at'], 
        reverse=True
    )
    
    conn.close()
    return jsonify({
        "success": True,
        "chats": chats_list
    })

@chat_bp.route('/api/chat/create_dialog', methods=['POST'])
def create_dialog():
    """Create a new dialog between two users"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    data = request.get_json()
    if not data or 'user_id' not in data:
        return jsonify({"success": False, "message": "Не указан ID пользователя"}), 400
    
    current_user_id = session.get('user_id')
    other_user_id = data['user_id']
    
    # Проверяем, что такой пользователь существует
    conn = get_db_connection()
    user = conn.execute('SELECT id, nickname FROM users WHERE id = ?', (other_user_id,)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({"success": False, "message": "Пользователь не найден"}), 404
    
    # Проверяем, что диалог с этим пользователем еще не создан
    existing_dialog = conn.execute('''
        SELECT d.id, d.chat_id FROM dialogs d
        WHERE (d.user1_id = ? AND d.user2_id = ?) OR (d.user1_id = ? AND d.user2_id = ?)
    ''', (current_user_id, other_user_id, other_user_id, current_user_id)).fetchone()
    
    if existing_dialog:
        # Диалог уже существует, возвращаем его ID
        chat_id = existing_dialog['chat_id']
        conn.close()
        return jsonify({
            "success": True, 
            "message": "Диалог уже существует", 
            "chat_id": chat_id
        })
    
    try:
        # Создаем новую запись в таблице chats
        conn.execute('INSERT INTO chats (chat_name, chat_type) VALUES (?, ?)', 
                    (None, 'dialog'))
        chat_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Создаем новый диалог
        conn.execute('''
            INSERT INTO dialogs (chat_id, user1_id, user2_id) 
            VALUES (?, ?, ?)
        ''', (chat_id, current_user_id, other_user_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Диалог успешно создан",
            "chat_id": chat_id,
            "user": {
                "id": user['id'],
                "nickname": user['nickname']
            }
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при создании диалога: {str(e)}"}), 500

@chat_bp.route('/api/chat/create_group', methods=['POST'])
def create_group():
    """Create a new group chat"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    # Проверяем, пришли ли данные в JSON или form-data
    if request.is_json:
        data = request.get_json()
        chat_name = data.get('chat_name')
        description = data.get('description', '')
        member_ids = data.get('member_ids', [])
    else:
        chat_name = request.form.get('chat_name')
        description = request.form.get('description', '')
        member_ids = request.form.getlist('member_ids')
    
    if not chat_name:
        return jsonify({"success": False, "message": "Не указано название группы"}), 400
    
    current_user_id = session.get('user_id')
    
    # Проверяем, существуют ли указанные пользователи
    conn = get_db_connection()
    for member_id in member_ids:
        user = conn.execute('SELECT id FROM users WHERE id = ?', (member_id,)).fetchone()
        if not user:
            conn.close()
            return jsonify({"success": False, "message": f"Пользователь с ID {member_id} не найден"}), 404
    
    # Добавляем текущего пользователя в список участников, если его там нет
    if str(current_user_id) not in [str(m) for m in member_ids]:
        member_ids.append(current_user_id)
    
    group_photo_data = None
    if 'group_photo' in request.files:
        group_photo = request.files['group_photo']
        if group_photo.filename:
            group_photo_data = group_photo.read()
    
    try:
        # Создаем новую запись в таблице chats
        conn.execute('INSERT INTO chats (chat_name, chat_type) VALUES (?, ?)', 
                    (chat_name, 'group'))
        chat_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Создаем новую группу
        conn.execute('''
            INSERT INTO group_chats (chat_id, creator_id, description, group_photo) 
            VALUES (?, ?, ?, ?)
        ''', (chat_id, current_user_id, description, group_photo_data))
        group_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        
        # Добавляем текущего пользователя как админа
        conn.execute('''
            INSERT INTO group_admins (group_chat_id, user_id, admin_level)
            VALUES (?, ?, ?)
        ''', (group_id, current_user_id, 2))  # 2 - суперадмин/создатель
        
        # Добавляем всех участников
        for member_id in member_ids:
            conn.execute('''
                INSERT INTO group_members (group_chat_id, user_id, invited_by, status)
                VALUES (?, ?, ?, ?)
            ''', (group_id, member_id, current_user_id, 'active'))
        
        conn.commit()
        
        # Создаем системное сообщение о создании группы
        conn.execute('''
            INSERT INTO messages (chat_id, sender_id, content)
            VALUES (?, ?, ?)
        ''', (chat_id, current_user_id, f"Группа '{chat_name}' создана"))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "message": "Группа успешно создана",
            "chat_id": chat_id,
            "group_id": group_id
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "message": f"Ошибка при создании группы: {str(e)}"}), 500

@chat_bp.route('/api/chat/group_photo/<int:group_id>', methods=['GET'])
def get_group_photo(group_id):
    """Get group chat photo"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Проверяем, является ли пользователь участником этой группы
    member = conn.execute('''
        SELECT gm.id FROM group_members gm
        JOIN group_chats gc ON gm.group_chat_id = gc.id
        WHERE gc.id = ? AND gm.user_id = ? AND gm.status = 'active'
    ''', (group_id, current_user_id)).fetchone()
    
    if not member:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к группе"}), 403
    
    # Получаем фото группы
    photo_data = conn.execute('''
        SELECT group_photo FROM group_chats WHERE id = ?
    ''', (group_id,)).fetchone()
    
    conn.close()
    
    if not photo_data or not photo_data['group_photo']:
        # Возвращаем дефолтное изображение для группы
        default_photo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                        'static', 'images', 'default_group.png')
        return send_file(default_photo_path, mimetype='image/png')
    
    return send_file(
        BytesIO(photo_data['group_photo']),
        mimetype='image/jpeg',
        as_attachment=False
    )

@chat_bp.route('/api/chat/<int:chat_id>/messages', methods=['GET'])
def get_chat_messages(chat_id):
    """Get messages for a specific chat"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    # Получаем параметры запроса
    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)
    after_id = request.args.get('after_id', None, type=int)  # ID сообщения, после которого нужны новые
    
    conn = get_db_connection()
    
    # Проверяем, имеет ли пользователь доступ к чату
    access = False
    
    # Проверяем, является ли это личным диалогом пользователя
    dialog = conn.execute('''
        SELECT id FROM dialogs
        WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, current_user_id, current_user_id)).fetchone()
    
    if dialog:
        access = True
    else:
        # Проверяем, является ли пользователь участником группового чата
        group = conn.execute('''
            SELECT gc.id FROM group_chats gc
            JOIN group_members gm ON gc.id = gm.group_chat_id
            WHERE gc.chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
        ''', (chat_id, current_user_id)).fetchone()
        
        if group:
            access = True
    
    if not access:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к чату"}), 403
    
    # Строим базовую часть запроса
    base_query = '''
        SELECT m.id, m.content, m.sender_id, u.nickname as sender_name,
               m.timestamp, m.is_edited, m.edited_at, 
               m.reply_to, m.media_type, m.forwarded_from,
               (SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id) as read_count
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
    '''
    
    params = [chat_id]
    
    # Модификация запроса в зависимости от параметров
    if after_id:
        # Получаем только новые сообщения после определенного ID
        base_query += ' AND m.id > ?'
        params.append(after_id)
        
        # Сортируем по времени (новейшие сверху)
        base_query += ' ORDER BY m.timestamp DESC'
    else:
        # Стандартный запрос с пагинацией
        base_query += ' ORDER BY m.timestamp DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
    
    # Выполняем запрос
    messages = conn.execute(base_query, params).fetchall()
    
    # Преобразуем результаты в удобный формат
    messages_list = []
    for message in messages:
        # Получаем информацию о сообщении, на которое был ответ
        reply_info = None
        if message['reply_to']:
            reply = conn.execute('''
                SELECT m.content, m.sender_id, u.nickname as sender_name
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?
            ''', (message['reply_to'],)).fetchone()
            
            if reply:
                reply_info = {
                    "id": message['reply_to'],
                    "content": reply['content'],
                    "sender_id": reply['sender_id'],
                    "sender_name": reply['sender_name']
                }
        
        # Получаем информацию о пересланном сообщении
        forwarded_info = None
        if message['forwarded_from']:
            forwarded = conn.execute('''
                SELECT m.content, m.sender_id, u.nickname as sender_name
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?
            ''', (message['forwarded_from'],)).fetchone()
            
            if forwarded:
                forwarded_info = {
                    "id": message['forwarded_from'],
                    "content": forwarded['content'],
                    "sender_id": forwarded['sender_id'],
                    "sender_name": forwarded['sender_name']
                }
        
        messages_list.append({
            "id": message['id'],
            "content": message['content'],
            "sender_id": message['sender_id'],
            "sender_name": message['sender_name'],
            "timestamp": message['timestamp'],
            "is_edited": bool(message['is_edited']),
            "edited_at": message['edited_at'],
            "media_type": message['media_type'],
            "has_media": message['media_type'] is not None,
            "read_count": message['read_count'],
            "reply_to": reply_info,
            "forwarded_from": forwarded_info,
            "is_own": message['sender_id'] == current_user_id
        })
    
    # Отмечаем сообщения как прочитанные (только если это не запрос новых сообщений)
    if not after_id:
        for message in messages:
            # Не отмечаем собственные сообщения
            if message['sender_id'] != current_user_id:
                conn.execute('''
                    INSERT OR IGNORE INTO message_reads (message_id, user_id)
                    VALUES (?, ?)
                ''', (message['id'], current_user_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "messages": messages_list,
        "total": len(messages_list),
        "has_more": len(messages_list) == limit and not after_id  # has_more имеет смысл только при пагинации
    })

@chat_bp.route('/api/chat/media/<int:message_id>', methods=['GET'])
def get_message_media(message_id):
    """Get media content from a specific message"""
    if 'user_id' not in session:
        return jsonify({"success": False, "message": "Не авторизован"}), 401
    
    current_user_id = session.get('user_id')
    
    conn = get_db_connection()
    
    # Получаем информацию о сообщении и проверяем доступ
    message_info = conn.execute('''
        SELECT m.media_content, m.media_type, m.chat_id
        FROM messages m
        WHERE m.id = ?
    ''', (message_id,)).fetchone()
    
    if not message_info or not message_info['media_content']:
        conn.close()
        return jsonify({"success": False, "message": "Медиафайл не найден"}), 404
    
    # Проверяем доступ к чату
    chat_id = message_info['chat_id']
    
    # Проверяем доступ - такой же код, как в get_chat_messages
    access = False
    dialog = conn.execute('''
        SELECT id FROM dialogs WHERE chat_id = ? AND (user1_id = ? OR user2_id = ?)
    ''', (chat_id, current_user_id, current_user_id)).fetchone()
    
    if dialog:
        access = True
    else:
        group = conn.execute('''
            SELECT gc.id FROM group_chats gc 
            JOIN group_members gm ON gc.id = gm.group_chat_id
            WHERE gc.chat_id = ? AND gm.user_id = ? AND gm.status = 'active'
        ''', (chat_id, current_user_id)).fetchone()
        
        if group:
            access = True
    
    if not access:
        conn.close()
        return jsonify({"success": False, "message": "Нет доступа к файлу"}), 403
    
    # Определяем тип файла для правильного MIME-типа
    media_type = message_info['media_type']
    mime_type = 'application/octet-stream'  # По умолчанию
    
    if media_type == 'image':
        mime_type = 'image/jpeg'
    elif media_type == 'video':
        mime_type = 'video/mp4'
    elif media_type == 'audio':
        mime_type = 'audio/mpeg'
    
    conn.close()
    
    # Возвращаем медиафайл
    return send_file(
        BytesIO(message_info['media_content']),
        mimetype=mime_type,
        as_attachment=False
    )
