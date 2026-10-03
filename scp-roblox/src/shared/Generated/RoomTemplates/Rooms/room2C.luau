--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2C",
	description = "An empty, plain corner room.",
	shape = "2C",
	commonness = 40,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2C",
	boundsMin = { -8, 0, -8 },
	boundsMax = { 25.6, 18.1708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 15.6, 12.8 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 12.8, 15.6, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { 0, 15.6, 0 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 3.2, 1.6, 4.025 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
