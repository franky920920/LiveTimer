const express = require('express')
const {Server} = require("socket.io")
const http = require('http')
const app = express()
const server = http.createServer(app)
const io = new Server(server)

const timers = new Array(4)
const password = process.env.PASSWORD ||
	new Array(5).fill(0).map(() => Math.floor(Math.random() * 10)).join('')

// 0 = countdown
// 1 = counter
// 2 = target timer
// 3 = now time

class Timer {
	type = 0
	_started = 0
	counted = 0
	interval
	position = 0
	
	constructor(position, title, down, type = 0) {
		this._started = down
		this.counted = down
		this.position = position
		this.title = title
		this.type = type ?? 0
		
		if(this.type === 3) {
			this.counted = this.seconds
			this.start()
		}
	}
	
	start() {
		if(this.interval)
			this.stop()
		this.interval = setInterval(() => {
			if(this.type === 0) {
				if(this.counted <= 0)
					return this.stop()
				this.counted--
				io.emit('timer', this.toJSON())
			}
			if(this.type === 1) {
				this.counted++
				io.emit('timer', this.toJSON())
			}
			if(this.type === 2) {
				this.counted = this._started - Date.now()
				io.emit('timer', this.toJSON())
			}
			if(this.type === 3) {
				this.counted = this.seconds
				io.emit('timer', this.toJSON())
			}
		}, 1000)
	}
	
	reset() {
		if(this.type === 3)
			return
		clearInterval(this.interval)
		this.interval = null
		this.counted = this._started ?? 0
	}
	
	stop() {
		clearInterval(this.interval)
		this.interval = null
	}
	
	toJSON() {
		return {
			position: this.position,
			title: this.title,
			counted: this.counted,
			paused: this.paused
		}
	}
	
	get seconds() {
		const date = new Date()
		return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
	}
	
	get paused() {
		return !this.interval
	}
}

app.use(express.static('web'))

io.on("connection", (socket) => {
	socket.emit('init', timers)
	
	socket.on('admin', (pass) => {
		if(pass !== password)
			return socket.disconnect()
		
		socket._authed = true
	})
	
	socket.on("set", ({index, title, down, type}) => {
		if(!socket._authed)
			return
		if(timers[index])
			timers[index].stop()
		timers[index] = new Timer(index, title, down, type)
		io.emit('init', timers.map(x => x?.toJSON()))
	})
	
	socket.on("start", (position) => {
		if(!socket._authed)
			return
		if(!timers[position].paused)
			return
		timers[position].start()
		socket.emit('init', timers.map(x => x?.toJSON()))
	})
	
	socket.on("stop", (position) => {
		if(!socket._authed)
			return
		if(timers[position].paused)
			return
		timers[position].stop()
		io.emit('init', timers.map(x => x?.toJSON()))
	})
	
	socket.on("reset", (position) => {
		if(!socket._authed)
			return
		timers[position].reset()
		io.emit('init', timers.map(x => x?.toJSON()))
	})
	
	socket.on("clear", (position) => {
		if(!socket._authed)
			return
		timers[position]?.stop()
		delete timers[position]
		io.emit('init', timers.map(x => x?.toJSON()))
	})
})

const port = Number(process.env.PORT) || 8080
server.listen(port, () => console.log(`Listening on port ${port}, password is: ${password}`))