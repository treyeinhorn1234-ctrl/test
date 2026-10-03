--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2doors",
	description = "Red-lit airlock room, in the shape of a T.",
	shape = "2",
	commonness = 30,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2doors",
	boundsMin = { -25.6, 0, -25.6 },
	boundsMax = { 6.4, 16, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 9.2, -7.6 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.2,
		},
		{
			position = { -9.6, 9.2, 0 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.2,
		},
		{
			position = { 0, 9.2, 7.2 },
			range = 17.5,
			color = { 255, 50, 50 },
			brightness = 1.2,
		},
		{
			position = { 0, 8.2, -23.2 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0, 8.2, 23.2 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.6, 0.025 },
		{ -20.8, 1.6, 0.025 },
	},
	sounds = {
		{
			position = { -20.3, 12.8, 0.025 },
			ambience = 4,
			range = 3,
		},
	},
	screens = {},
	props = {},
	playerStarts = {},
}
