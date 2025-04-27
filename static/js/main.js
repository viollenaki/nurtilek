/**
 * Основной JS файл для функциональности главной страницы
 */

document.addEventListener('DOMContentLoaded', function() {
    // Переменные для элементов интерфейса
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    // Создаем элемент для эффекта вспышки при смене темы
    const flashElement = document.createElement('div');
    flashElement.className = 'theme-flash';
    document.body.appendChild(flashElement);
    
    // Проверяем сохраненную тему
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        themeIcon.src = '/static/images/moon.png';
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        themeIcon.src = '/static/images/sun.png';
    }
    
    // Переключение темы
    themeToggle.addEventListener('click', () => {
        // Активируем эффект вспышки
        flashElement.classList.add('active');
        
        // Переключаем тему
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');
        
        // Меняем иконку темы
        if(document.body.classList.contains('dark-theme')) {
            themeIcon.src = '/static/images/moon.png';
            localStorage.setItem('theme', 'dark');
        } else {
            themeIcon.src = '/static/images/sun.png';
            localStorage.setItem('theme', 'light');
        }
        
        // Удаляем класс активности для вспышки
        setTimeout(() => {
            flashElement.classList.remove('active');
        }, 700); // Должно соответствовать продолжительности анимации
    });

    // Функционал мобильного меню
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        sidebar.addEventListener('click', function(e) {
            // Предотвращаем схлопывание при нажатии на элементы внутри
            if (e.target === this || e.target.closest('.user-info')) {
                this.classList.toggle('expanded');
            }
        });

        // Создаем кнопку для показа/скрытия сайдбара
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'sidebar-toggle';
        toggleBtn.innerHTML = '☰';
        document.body.appendChild(toggleBtn);
        
        toggleBtn.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('visible');
        });
        
        // Показываем сайдбар по умолчанию, если нет активного чата
        if (!window.chatModule || !window.chatModule.getCurrentChatId()) {
            document.querySelector('.sidebar').classList.add('visible');
        }
    }

    // Функционал бокового меню опций
    const optionsMenuBtn = document.getElementById('options-menu-btn');
    const chatOptionsMenuBtn = document.getElementById('chat-options-menu-btn');
    const optionsDrawer = document.getElementById('options-drawer');
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    const drawerOverlay = document.getElementById('drawer-overlay');
    
    // Открытие бокового меню
    optionsMenuBtn?.addEventListener('click', function() {
        optionsDrawer.classList.add('active');
    });
    
    // Открытие бокового меню при клике на иконку в заголовке чата
    chatOptionsMenuBtn?.addEventListener('click', function() {
        optionsDrawer.classList.add('active');
    });
    
    // Закрытие бокового меню
    function closeDrawer() {
        optionsDrawer.classList.remove('active');
    }
    
    drawerCloseBtn?.addEventListener('click', closeDrawer);
    drawerOverlay?.addEventListener('click', closeDrawer);
    
    // При клике вне меню закрываем его
    document.addEventListener('click', function(event) {
        if (optionsDrawer.classList.contains('active') && 
            !optionsDrawer.contains(event.target) && 
            event.target !== optionsMenuBtn && 
            event.target !== chatOptionsMenuBtn) {
            closeDrawer();
        }
    });
    
    // Обработчики для элементов меню
    document.querySelectorAll('.drawer-item').forEach(item => {
        item.addEventListener('click', function() {
            const action = this.querySelector('.drawer-item-text').textContent;
            const currentChatId = getCurrentChatId();
            switch(action) {
                case 'Shared photos':
                    if (currentChatId) {
                        openSharedPhotosModal(currentChatId);
                    } else {
                        alert('Сначала выберите чат');
                    }
                    break;
                case 'Shared files':
                    if (currentChatId) {
                        openSharedFilesModal(currentChatId);
                    } else {
                        alert('Сначала выберите чат');
                    }
                    break;
                case 'Shared links':
                    if (currentChatId) {
                        openSharedLinksModal(currentChatId);
                    } else {
                        alert('Сначала выберите чат');
                    }
                    break;
                case 'Block user':
                    if(confirm('Вы действительно хотите заблокировать этого пользователя?')) {
                        console.log('User blocked');
                    }
                    break;
            }
            closeDrawer();
        });
    });

    // Кнопка нового чата
    const actionButton = document.querySelector('.action-button');
    if (actionButton) {
        actionButton.addEventListener('click', function() {
            // Открываем модальное окно для выбора пользователя
            const newChatMainBtn = document.getElementById('new-chat-main-btn');
            if (newChatMainBtn) {
                newChatMainBtn.click();
            }
        });
    }

    // Улучшенная функция для обновления URL изображения профиля с новой меткой времени
    function updateProfileImage() {
        const profileImg = document.getElementById('userProfileImage');
        if (profileImg) {
            const timestamp = new Date().getTime();
            const newSrc = `/api/user/photo?t=${timestamp}`;
            
            // Создаем новый объект Image для предварительной загрузки
            const preloadImg = new Image();
            preloadImg.onload = function() {
                profileImg.src = newSrc;
            };
            preloadImg.onerror = function() {
                profileImg.src = '/static/images/avatar.png';
            };
            preloadImg.src = newSrc;
        }
    }
    
    // Обновляем изображение при загрузке страницы
    updateProfileImage();
    
    // Также обновляем при нажатии на кнопку обновления
    const refreshIcon = document.querySelector('.refresh-icon');
    if (refreshIcon) {
        refreshIcon.addEventListener('click', function() {
            updateProfileImage();
            // Также обновляем список чатов
            if (window.chatModule) {
                window.chatModule.updateChatsList();
            }
        });
    }

    // Инициализация функционала поиска пользователей для нового чата
    const userSearchInput = document.getElementById('user-search-input');
    const searchResults = document.getElementById('search-results');
    const searchLoading = document.getElementById('search-loading');

    if (typeof initUserSearch === 'function' && userSearchInput && searchResults) {
        initUserSearch({
            searchInput: userSearchInput,
            resultsContainer: searchResults,
            loadingIndicator: searchLoading,
            onUserSelected: async function(userData) {
                try {
                    // Создаем чат с выбранным пользователем
                    const response = await fetch('/api/chat/create_dialog', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ user_id: userData.id })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Закрываем модальное окно
                        const modalOverlay = document.getElementById('new-chat-modal');
                        if (modalOverlay) {
                            modalOverlay.classList.remove('active');
                        }
                        
                        // Обновляем список чатов
                        if (window.chatModule) {
                            await window.chatModule.updateChatsList();
                            
                            // Открываем созданный чат
                            window.chatModule.openChat(
                                data.chat_id, 
                                'dialog',
                                userData.nickname
                            );
                        } else {
                            // Если модуль чата не инициализирован, просто перезагружаем страницу
                            location.reload();
                        }
                    } else {
                        alert(`Ошибка: ${data.message}`);
                    }
                } catch (error) {
                    console.error('Error creating chat:', error);
                    alert('Произошла ошибка при создании чата');
                }
            }
        });
    }
    
    // Инициализация компонента чата
    if (window.chatModule && typeof window.chatModule.initChatComponent === 'function') {
        window.chatModule.initChatComponent();
        
        // Проверяем был ли выбран чат ранее (например, сохраненный в localStorage)
        const lastChatId = localStorage.getItem('lastChatId');
        const lastChatType = localStorage.getItem('lastChatType');
        const lastChatName = localStorage.getItem('lastChatName');
        const lastGroupId = localStorage.getItem('lastGroupId');
        
        if (lastChatId && lastChatType && lastChatName) {
            setTimeout(() => {
                window.chatModule.openChat(lastChatId, lastChatType, lastChatName, lastGroupId);
            }, 1000);
        }
    }

    // Обработка выпадающего меню пользователя
    const optionsDropdown = document.getElementById('options-dropdown');
    
    // Показать/скрыть выпадающее меню при клике на иконку
    optionsMenuBtn?.addEventListener('click', function(e) {
        e.stopPropagation(); // Предотвращаем всплытие события
        optionsDropdown.classList.toggle('active');
    });
    
    // Скрыть меню при клике в любом месте страницы
    document.addEventListener('click', function(e) {
        if (optionsDropdown && optionsDropdown.classList.contains('active') && 
            !optionsDropdown.contains(e.target)) {
            optionsDropdown.classList.remove('active');
        }
    });
    
    // Обработчик для кнопки выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            // Здесь можно добавить запрос на сервер для выхода
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/login';
                } else {
                    console.error('Ошибка при выходе:', data.message);
                }
            })
            .catch(error => {
                console.error('Ошибка при выходе:', error);
            });
        });
    }
    
    // Обработчик для кнопки настроек профиля
    const profileSettingsBtn = document.getElementById('profile-settings-btn');
    if (profileSettingsBtn) {
        profileSettingsBtn.addEventListener('click', function() {
            // Закрываем выпадающее меню
            optionsDropdown.classList.remove('active');
            
            // Открываем модальное окно редактирования профиля
            const profileModal = document.getElementById('edit-profile-modal');
            if (profileModal) {
                profileModal.classList.add('active');
            }
        });
    }

    // Инициализация модальных окон для медиафайлов
    initMediaModals();
});

// Функция для получения текущего чата
function getCurrentChatId() {
    return window.chatModule ? window.chatModule.getCurrentChatId() : null;
}

// Инициализация модальных окон для медиафайлов
function initMediaModals() {
    // Общие фотографии
    const sharedPhotosModal = document.getElementById('shared-photos-modal');
    const sharedPhotosCloseBtn = document.getElementById('shared-photos-close-btn');
    
    sharedPhotosCloseBtn?.addEventListener('click', function() {
        sharedPhotosModal.classList.remove('active');
    });
    
    sharedPhotosModal?.addEventListener('click', function(e) {
        if (e.target === sharedPhotosModal) {
            sharedPhotosModal.classList.remove('active');
        }
    });
    
    // Общие файлы
    const sharedFilesModal = document.getElementById('shared-files-modal');
    const sharedFilesCloseBtn = document.getElementById('shared-files-close-btn');
    
    sharedFilesCloseBtn?.addEventListener('click', function() {
        sharedFilesModal.classList.remove('active');
    });
    
    sharedFilesModal?.addEventListener('click', function(e) {
        if (e.target === sharedFilesModal) {
            sharedFilesModal.classList.remove('active');
        }
    });
    
    // Общие ссылки
    const sharedLinksModal = document.getElementById('shared-links-modal');
    const sharedLinksCloseBtn = document.getElementById('shared-links-close-btn');
    
    sharedLinksCloseBtn?.addEventListener('click', function() {
        sharedLinksModal.classList.remove('active');
    });
    
    sharedLinksModal?.addEventListener('click', function(e) {
        if (e.target === sharedLinksModal) {
            sharedLinksModal.classList.remove('active');
        }
    });
}

// Открытие модального окна с общими фотографиями
function openSharedPhotosModal(chatId) {
    const modal = document.getElementById('shared-photos-modal');
    const container = document.getElementById('shared-photos-container');
    const noMediaMessage = modal.querySelector('.no-media-message');
    
    // Показываем индикатор загрузки
    container.innerHTML = '<div class="loading-indicator">Загрузка фотографий...</div>';
    noMediaMessage.style.display = 'none';
    
    // Открываем модальное окно
    modal.classList.add('active');
    
    // Имитация загрузки фотографий (в реальном проекте здесь был бы API запрос)
    setTimeout(() => {
        // Симуляция данных с сервера
        const photos = [
            { id: 1, url: 'https://via.placeholder.com/300x300?text=Photo+1', date: '2023-06-10' },
            { id: 2, url: 'https://via.placeholder.com/300x300?text=Photo+2', date: '2023-06-11' },
            { id: 3, url: 'https://via.placeholder.com/300x300?text=Photo+3', date: '2023-06-12' },
            { id: 4, url: 'https://via.placeholder.com/300x300?text=Photo+4', date: '2023-06-13' },
            { id: 5, url: 'https://via.placeholder.com/300x300?text=Photo+5', date: '2023-06-14' },
            { id: 6, url: 'https://via.placeholder.com/300x300?text=Photo+6', date: '2023-06-15' }
        ];
        
        if (photos.length === 0) {
            container.innerHTML = '';
            noMediaMessage.style.display = 'block';
            return;
        }
        
        // Создаем элементы для каждого фото
        let photosHTML = '';
        photos.forEach(photo => {
            photosHTML += `
                <div class="shared-photo-item" data-id="${photo.id}" data-url="${photo.url}">
                    <img src="${photo.url}" alt="Photo ${photo.id}">
                </div>
            `;
        });
        
        container.innerHTML = photosHTML;
        
        // Добавляем обработчики для просмотра фото
        document.querySelectorAll('.shared-photo-item').forEach(item => {
            item.addEventListener('click', function() {
                openLightbox(this.dataset.url, photos.map(p => p.url));
            });
        });
    }, 800);
}

// Открытие модального окна с общими файлами
function openSharedFilesModal(chatId) {
    const modal = document.getElementById('shared-files-modal');
    const container = document.getElementById('shared-files-container');
    const noMediaMessage = modal.querySelector('.no-media-message');
    
    // Показываем индикатор загрузки
    container.innerHTML = '<div class="loading-indicator">Загрузка файлов...</div>';
    noMediaMessage.style.display = 'none';
    
    // Открываем модальное окно
    modal.classList.add('active');
    
    // Имитация загрузки файлов (в реальном проекте здесь был бы API запрос)
    setTimeout(() => {
        // Симуляция данных с сервера
        const files = [
            { id: 1, name: 'document.pdf', size: '2.5 MB', date: '10 июля 2023', type: 'pdf' },
            { id: 2, name: 'presentation.pptx', size: '5.1 MB', date: '15 июля 2023', type: 'pptx' },
            { id: 3, name: 'spreadsheet.xlsx', size: '1.8 MB', date: '20 июля 2023', type: 'xlsx' },
            { id: 4, name: 'report.docx', size: '3.2 MB', date: '25 июля 2023', type: 'docx' }
        ];
        
        if (files.length === 0) {
            container.innerHTML = '';
            noMediaMessage.style.display = 'block';
            return;
        }
        
        // Определяем иконку для каждого типа файла
        function getFileIcon(type) {
            const icons = {
                'pdf': '📄',
                'docx': '📝',
                'xlsx': '📊',
                'pptx': '📑',
                'default': '📁'
            };
            
            return icons[type] || icons.default;
        }
        
        // Создаем элементы для каждого файла
        container.innerHTML = '';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'shared-file-item';
            fileItem.innerHTML = `
                <div class="file-icon">${getFileIcon(file.type)}</div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-details">
                        <span class="file-size">${file.size}</span>
                        <span class="file-date">${file.date}</span>
                    </div>
                </div>
            `;
            
            // Добавляем обработчик для скачивания файла
            fileItem.addEventListener('click', function() {
                alert(`Скачиваем файл: ${file.name}`);
                // В реальном проекте здесь был бы код для скачивания файла
            });
            
            container.appendChild(fileItem);
        });
    }, 800);
}

// Открытие модального окна с общими ссылками
function openSharedLinksModal(chatId) {
    const modal = document.getElementById('shared-links-modal');
    const container = document.getElementById('shared-links-container');
    const noMediaMessage = modal.querySelector('.no-media-message');
    
    // Показываем индикатор загрузки
    container.innerHTML = '<div class="loading-indicator">Загрузка ссылок...</div>';
    noMediaMessage.style.display = 'none';
    
    // Открываем модальное окно
    modal.classList.add('active');
    
    // Имитация загрузки ссылок (в реальном проекте здесь был бы API запрос)
    setTimeout(() => {
        // Симуляция данных с сервера
        const links = [
            { id: 1, title: 'Google', url: 'https://www.google.com', sender: 'Андрей', date: '10 июля 2023' },
            { id: 2, title: 'GitHub', url: 'https://github.com', sender: 'Мария', date: '12 июля 2023' },
            { id: 3, title: 'Stack Overflow', url: 'https://stackoverflow.com', sender: 'Иван', date: '15 июля 2023' },
            { id: 4, title: 'MDN Web Docs', url: 'https://developer.mozilla.org', sender: 'Елена', date: '18 июля 2023' }
        ];
        
        if (links.length === 0) {
            container.innerHTML = '';
            noMediaMessage.style.display = 'block';
            return;
        }
        
        // Создаем элементы для каждой ссылки
        container.innerHTML = '';
        links.forEach(link => {
            const linkItem = document.createElement('div');
            linkItem.className = 'shared-link-item';
            linkItem.innerHTML = `
                <div class="link-title">${link.title}</div>
                <a href="${link.url}" target="_blank" class="link-url">${link.url}</a>
                <div class="link-details">Отправлено: ${link.sender} | ${link.date}</div>
            `;
            
            container.appendChild(linkItem);
        });
    }, 800);
}

// Функция для открытия лайтбокса с фотографией
function openLightbox(imageUrl, allImages = []) {
    // Создаем элементы лайтбокса
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-overlay';
    
    let currentIndex = allImages.indexOf(imageUrl);
    
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <img src="${imageUrl}" class="lightbox-img" alt="Фото">
            <button class="lightbox-close">&times;</button>
            ${allImages.length > 1 ? `
                <button class="lightbox-nav lightbox-prev">&lt;</button>
                <button class="lightbox-nav lightbox-next">&gt;</button>
            ` : ''}
        </div>
    `;
    
    document.body.appendChild(lightbox);
    
    // Предотвращаем скролл страницы
    document.body.style.overflow = 'hidden';
    
    // Обработчик закрытия лайтбокса
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // Обработчики для навигации (если есть несколько изображений)
    if (allImages.length > 1) {
        // Предыдущее изображение
        lightbox.querySelector('.lightbox-prev').addEventListener('click', function() {
            currentIndex = (currentIndex - 1 + allImages.length) % allImages.length;
            updateLightboxImage(allImages[currentIndex]);
        });
        
        // Следующее изображение
        lightbox.querySelector('.lightbox-next').addEventListener('click', function() {
            currentIndex = (currentIndex + 1) % allImages.length;
            updateLightboxImage(allImages[currentIndex]);
        });
        
        // Навигация с помощью клавиатуры
        document.addEventListener('keydown', keyNavHandler);
    }
    
    // Обновление изображения в лайтбоксе
    function updateLightboxImage(newUrl) {
        const img = lightbox.querySelector('.lightbox-img');
        img.src = newUrl;
    }
    
    // Обработчик нажатий клавиш для навигации
    function keyNavHandler(e) {
        if (e.key === 'ArrowLeft') {
            currentIndex = (currentIndex - 1 + allImages.length) % allImages.length;
            updateLightboxImage(allImages[currentIndex]);
        } else if (e.key === 'ArrowRight') {
            currentIndex = (currentIndex + 1) % allImages.length;
            updateLightboxImage(allImages[currentIndex]);
        } else if (e.key === 'Escape') {
            closeLightbox();
        }
    }
    
    // Функция закрытия лайтбокса
    function closeLightbox() {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', keyNavHandler);
        lightbox.remove();
    }
}
