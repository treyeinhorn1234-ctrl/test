--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2",
	description = "An empty, two-door hallway.",
	shape = "2",
	commonness = 45,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room2",
	boundsMin = { -7.6, -0.025, -25.6 },
	boundsMax = { 7.6, 18.1708, 25.6 },
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
	},
	spotlights = {},
	waypoints = {
		{ 0, 1.65, 0.1 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
