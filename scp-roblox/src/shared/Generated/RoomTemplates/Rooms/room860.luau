--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room860",
	description = "SCP-860-1's containment chamber. Can't be traversed without SCP-860.",
	shape = "2",
	commonness = 0,
	large = false,
	disableDecals = false,
	zones = {},
	asset = "room860",
	boundsMin = { -7.6, -0.8, -25.6 },
	boundsMax = { 32, 18.1708, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 4.6034, 17.2472, 9.5761 },
			range = 25,
			color = { 255, 255, 255 },
			brightness = 1.5,
		},
		{
			position = { 4.6034, 17.2472, -9.6239 },
			range = 25,
			color = { 255, 255, 255 },
			brightness = 1.5,
		},
		{
			position = { 0.0034, 17.2472, 20.7761 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { 0.0034, 17.2472, -20.8239 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {
		{ 10.4, 1.65, 20.7 },
		{ 10.4, 1.65, -20.9 },
		{ 23.4, 1.65, -0.1 },
	},
	sounds = {},
	screens = {
		{
			position = { 29.85, 6.6, 9.5 },
			image = "860.jpg",
		},
	},
	props = {},
	playerStarts = {},
}
