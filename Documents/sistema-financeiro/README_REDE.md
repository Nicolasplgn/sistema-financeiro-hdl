# 🌐 Como Liberar o Sistema para Acesso na Rede Local

Este guia explica como configurar o sistema para que qualquer pessoa da sua rede local possa acessá-lo.

## 📋 Pré-requisitos

1. Todos os computadores devem estar na mesma rede Wi-Fi/Ethernet
2. O computador servidor deve estar ligado e conectado à rede
3. Firewall do Windows deve permitir conexões nas portas 3000 e 4000

## 🔧 Passo a Passo

### 1. Descobrir o IP Local do Servidor

**Windows:**
```cmd
ipconfig
```
Procure por "IPv4" na sua conexão ativa (Wi-Fi ou Ethernet). Exemplo: `192.168.1.100`

**Linux/Mac:**
```bash
ifconfig
# ou
ip addr
```

### 2. Configurar o Backend

O backend já está configurado para aceitar conexões de qualquer IP (`0.0.0.0`).

Para iniciar o backend:
```bash
cd backend
npm start
# ou
node server.js
```

Você verá uma mensagem como:
```
🚀 Servidor rodando em http://localhost:4000
📡 Acessível na rede local em: http://[SEU_IP_LOCAL]:4000
```

### 3. Configurar o Frontend

**Opção A: Usando Variável de Ambiente (Recomendado)**

1. Crie um arquivo `.env` na pasta `frontend`:
```bash
cd frontend
copy .env.example .env
```

2. Edite o arquivo `.env` e coloque o IP do servidor:
```
VITE_API_URL=http://192.168.1.100:4000
```
*(Substitua `192.168.1.100` pelo IP do seu servidor)*

3. Inicie o frontend:
```bash
npm run dev
```

**Opção B: Editar Manualmente**

Se preferir não usar variável de ambiente, edite o arquivo `frontend/src/config.js` e altere:
```javascript
const API_BASE_URL = 'http://192.168.1.100:4000';
```

### 4. Configurar Firewall do Windows

1. Abra o **Firewall do Windows Defender**
2. Clique em **Configurações Avançadas**
3. Clique em **Regras de Entrada** → **Nova Regra**
4. Selecione **Porta** → **Próximo**
5. Selecione **TCP** e digite as portas: `3000, 4000`
6. Selecione **Permitir a conexão** → **Próximo**
7. Marque todas as opções → **Próximo**
8. Nome: "Sistema Financeiro" → **Concluir**

### 5. Acessar de Outros Computadores

Nos outros computadores da rede, abra o navegador e acesse:
```
http://[IP_DO_SERVIDOR]:3000
```

Exemplo: `http://192.168.1.100:3000`

## 🔍 Verificar se Está Funcionando

1. No servidor, abra o navegador e acesse `http://localhost:3000` - deve funcionar
2. Em outro computador da rede, acesse `http://[IP_SERVIDOR]:3000` - deve funcionar
3. Se não funcionar, verifique:
   - Firewall do Windows
   - Se os computadores estão na mesma rede
   - Se o IP está correto

## ⚠️ Importante

- O IP pode mudar se o servidor desconectar/reconectar na rede
- Para IP fixo, configure DHCP reservado no roteador ou IP estático no Windows
- Para produção, considere usar um domínio ou serviço como ngrok

## 🚀 Dica: IP Fixo

Para evitar ter que mudar o IP toda vez, configure um IP fixo no Windows:

1. Painel de Controle → Rede e Internet → Centro de Rede e Compartilhamento
2. Clique na sua conexão → Propriedades
3. Protocolo IP Versão 4 (TCP/IPv4) → Propriedades
4. Marque "Usar o seguinte endereço IP"
5. Configure um IP dentro da faixa da sua rede (ex: 192.168.1.100)
6. Máscara de sub-rede: 255.255.255.0
7. Gateway padrão: IP do seu roteador (geralmente 192.168.1.1)

