1. Копируем репозиторий
   git clone https://github.com/Dimanchos/k8s_monitoring_app.git

2. Перемещаемся в каталог
   cd k8s_monitoring_app

3. Билдим образ
   sudo docker build -t k8s-monitoring-app:latest .

4. Запускаем наш приложение в контейнере
   docker run -d   -p 8080:8080   -e PROMETHEUS_URL=http://prometheus-server:9090   --name k8s-monitoring   k8s-monitoring-app:latest //где  PROMETHEUS_URL=http://prometheus-server:9090 = адрес нашего сервера

5. Заходим в браузер http://адрес приложения:8080
