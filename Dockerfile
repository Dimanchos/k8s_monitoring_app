# Этап сборки
FROM golang:1.22-alpine as builder

WORKDIR /app

# Копируем исходный код
COPY . .

# Собираем приложение
RUN CGO_ENABLED=0 GOOS=linux go build -o monitoring-app .

# Этап запуска
FROM alpine:3.18

WORKDIR /app

# Копируем бинарник из этапа сборки
COPY --from=builder /app/monitoring-app .
# Копируем статические файлы
COPY ./static ./static

# Указываем порт, который будет использоваться
EXPOSE 8080

# Команда для запуска приложения
CMD ["./monitoring-app"]
