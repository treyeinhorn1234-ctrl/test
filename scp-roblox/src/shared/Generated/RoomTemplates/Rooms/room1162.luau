--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room1162",
	description = "SCP-1162's containment chamber, in a corner room.",
	shape = "2C",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room1162",
	boundsMin = { -8, -0.8, -8 },
	boundsMax = { 25.6, 18.8213, 25.695 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 15.5, 12.8 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0, 15.5, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 23.4217, 17.3239, 16.6 },
			range = 15,
			color = { 255, 220, 220 },
			brightness = 0.8,
		},
		{
			position = { 12.8, 15.5, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 9.4217, 17.3239, 16.6 },
			range = 15,
			color = { 255, 220, 220 },
			brightness = 0.8,
		},
	},
	spotlights = {},
	waypoints = {
		{ 3.2, 1.6, 4.025 },
	},
	sounds = {},
	screens = {},
	props = {
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, 12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, 0 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "monitor",
			file = "monitor.x",
			position = { 9.6014, 3, 24.8282 },
			rotation = { -1, 0, 0, 0, 1, 0, 0, 0, -1 },
			scale = { 1.6, 1.6, 1.6 },
		},
		{
			model = "keyboard",
			file = "keyboard.x",
			position = { 9.5807, 3, 23.8308 },
			rotation = { -1, 0, 0, 0, 1, 0, 0, 0, -1 },
			scale = { 1.7, 1.7, 1.7 },
		},
		{
			model = "officeseat_a",
			file = "officeseat_a.x",
			position = { 9.1914, 0, 23.2015 },
			rotation = { -0.99619, 0, -0.08716, 0, 1, 0, 0.08716, 0, -0.99619 },
			scale = { 3.5, 3.5, 3.5 },
		},
		{
			model = "lamp2",
			file = "lamp2.x",
			position = { 12.8, 15.5, 0 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
