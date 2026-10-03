--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "lockroom",
	description = "A timed airlock room, with two doors.",
	shape = "2C",
	commonness = 30,
	large = false,
	disableDecals = false,
	zones = { 1, 3 },
	asset = "lockroom",
	boundsMin = { -21.6, 0, -21.6 },
	boundsMax = { 25.6, 16, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 20.8, 8.2, -5.6 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { -10.4, 9.2, -17.6 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.2,
		},
		{
			position = { -10.4, 9.2, -4.8 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.2,
		},
		{
			position = { -5.6, 8.2, 20 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {
		{ 20.7, 0.8, -1.575 },
		{ 20.7, 0.8, -18.375 },
		{ -5.7, 0.8, -18.375 },
		{ -18.1, 0.8, -3.575 },
		{ -18.5, 0.8, 20.425 },
		{ -2.5, 0.8, 20.825 },
	},
	sounds = {
		{
			position = { -10.7, 12.8, -11.175 },
			ambience = 4,
			range = 3,
		},
	},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 20.8, 8.2, -5.6 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { -5.6, 8.2, 20 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
