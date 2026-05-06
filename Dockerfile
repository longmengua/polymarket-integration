# 使用官方 Node image
FROM node

# 建立 app 目錄
WORKDIR /app

# 先 copy package（利用 cache）
COPY package*.json ./

# 安裝依賴
RUN npm install

# copy 全部
COPY . .

# build
RUN npm run build

# expose port
EXPOSE 3000

# 啟動
CMD ["npm", "start"]