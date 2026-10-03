--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2_4",
	description = "A two-door hallway, with a unopenable door off to the side.",
	shape = "2",
	commonness = 30,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2_4",
	boundsMin = { -7.6, -0.025, -25.6 },
	boundsMax = { 19.3, 17.6717, 25.6 },
	parts = {
		white = { 6.4, -0.013, 0, 25.6, 0.025, 51.2 },
		concretefloor = { 5.8, 8.8, 0, 26.8, 17.65, 51.2 },
		whitewall = { 5.85, 8.8, 0, 26.9, 17.6, 51.2 },
		dirtymetal = { 0, 15, 0, 14.8, 1.6, 41.6 },
		metalpanels2 = { 5.85, 11.175, 0.3, 26.9, 4.85, 50.6 },
		misc = { 6.524, 17.624, 7.1, 13.6, 0.096, 28 },
		door01 = { 19, 4, 20.788, 0.4, 8, 4.8 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { 0.0217, 17.3239, -6.4 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0.0217, 17.3239, 8 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 12.8239, 17.3239, 20.8022 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.65, 0.1 },
		{ 12.8, 0.8, 20.825 },
		{ 0, 0.8, 20.825 },
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
			model = "lamp2",
			file = "lamp2.x",
			position = { 0, 15.5, -12.8 },
			rotation = { 1, 0, 0, 0, 1, 0, 0, 0, 1 },
			scale = { 1, 1, 1 },
		},
	},
	playerStarts = {},
}
