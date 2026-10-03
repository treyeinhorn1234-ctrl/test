--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2tesla",
	description = "Hallway with a tesla gate. EZ variant.",
	shape = "2",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room2tesla",
	boundsMin = { -7.6, -1.6, -25.6 },
	boundsMax = { 7.6, 18.0614, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 6.4, 8.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { 6.4, 12.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { 6.4, 4.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { -6.4, 8.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { -6.4, 12.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { -6.4, 4.4, 0 },
			range = 10,
			color = { 191, 251, 255 },
			brightness = 1,
		},
		{
			position = { 0.0217, 17.3239, -6.4 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0.0217, 17.3239, 6.4 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.65, -18.3 },
		{ 0, 1.65, -7.9 },
		{ 0, 1.65, 7.3 },
		{ 0, 1.65, 17.7 },
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
			position = { 0, 15.5, -12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
		{
			model = "elecbox",
			file = "elecbox.x",
			position = { -6.1287, 5.6, -9.7706 },
			rotation = { 0, 0, -1, 0, 1, 0, 1, 0, 0 },
			scale = { 12.5, 12.5, 12.5 },
		},
	},
	playerStarts = {},
}
