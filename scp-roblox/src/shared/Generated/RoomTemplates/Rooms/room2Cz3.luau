--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2Cz3",
	description = "A corner room, with two benches against the walls.",
	shape = "2C",
	commonness = 100,
	large = false,
	disableDecals = false,
	zones = { 3 },
	asset = "room2Cz3",
	boundsMin = { -14.4, -0.025, -14.4 },
	boundsMax = { 25.6, 10.9708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 2.4, 9.2239, -9.9261 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
		{
			position = { -9.9022, 9.2239, 3.1761 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
		{
			position = { 0.0261, 10.1239, 19.2 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
		{
			position = { 19.2, 10.1239, -0.0261 },
			range = 12.5,
			color = { 255, 255, 255 },
			brightness = 1.8,
		},
	},
	spotlights = {},
	waypoints = {
		{ 8, 2, -0.0063 },
		{ 0, 2, 7.9938 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
